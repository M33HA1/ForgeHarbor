//go:build integration

package integration

import (
 "context"
 "crypto/rand"
 "crypto/rsa"
 "crypto/sha256"
 "crypto/x509"
 "encoding/hex"
 "encoding/json"
 "encoding/pem"
 "errors"
 "net/http/httptest"
 "os"
 "strings"
 "sync"
 "sync/atomic"
 "testing"
 "time"

 "forgeharbor/controlplane/internal/auth"
 "forgeharbor/controlplane/internal/platform"
 "github.com/redis/go-redis/v9"
 "github.com/pquerna/otp/totp"
 "go.mongodb.org/mongo-driver/v2/bson"
 "go.mongodb.org/mongo-driver/v2/mongo"
 "go.mongodb.org/mongo-driver/v2/mongo/options"
)

func digestToken(token string)string{sum:=sha256.Sum256([]byte(token));return hex.EncodeToString(sum[:])}
func totpCode(secret string)(string,error){return totp.GenerateCode(secret,time.Now())}
func newMFAService(t *testing.T,db *mongo.Database,cache *redis.Client,mfa *auth.MFA)*auth.Service{
 t.Helper();key,err:=rsa.GenerateKey(rand.Reader,2048);if err!=nil{t.Fatal(err)};public,_:=x509.MarshalPKIXPublicKey(&key.PublicKey)
 tokens,err:=platform.NewTokens(pem.EncodeToMemory(&pem.Block{Type:"PUBLIC KEY",Bytes:public}),pem.EncodeToMemory(&pem.Block{Type:"RSA PRIVATE KEY",Bytes:x509.MarshalPKCS1PrivateKey(key)}),"forgeharbor","forgeharbor-users");if err!=nil{t.Fatal(err)}
 return &auth.Service{Users:auth.MongoUsers{Collection:db.Collection("users")},Sessions:auth.RedisSessions{Client:cache},Tokens:tokens,Passwords:auth.NewPasswords(),Breach:syntheticBreach{},CookieSecure:true,MFA:mfa}
}

func TestMFAAtomicStorageAndChallengeBounds(t *testing.T){
 ctx,cancel:=context.WithTimeout(context.Background(),45*time.Second);defer cancel()
 client,err:=mongo.Connect(options.Client().ApplyURI(os.Getenv("MONGO_URI")));if err!=nil{t.Fatal(err)};defer client.Disconnect(context.Background())
 name:="fh_mfa_fixture_"+strings.ReplaceAll(platform.UUID(),"-","");db:=client.Database(name)
 defer func(){if !strings.HasPrefix(name,"fh_mfa_fixture_"){t.Fatal("unsafe cleanup")};if db.Drop(context.Background())!=nil{t.Error("fixture cleanup")}}()
 opts,err:=redis.ParseURL(os.Getenv("REDIS_URL"));if err!=nil{t.Fatal("Redis config")};cache:=redis.NewClient(opts);defer cache.Close()
 states:=auth.MongoMFA{Collection:db.Collection("users")};challenges:=auth.RedisMFAChallenges{Client:cache};user:=platform.UUID()
 if _,err=db.Collection("users").InsertOne(ctx,bson.M{"user_id":user});err!=nil{t.Fatal(err)}
 state:=auth.MFAState{Enabled:true,Version:platform.UUID(),Cipher:"synthetic-encrypted-value",LastStep:5,Recovery:[]string{"synthetic-hash"}}
 if ok,err:=states.Enable(ctx,user,"",state);err!=nil||!ok{t.Fatal("legacy enrollment CAS")}
 if ok,_:=states.Enable(ctx,user,"",state);ok{t.Fatal("concurrent enrollment overwrite")}
 race:=func(fn func()(bool,error)){t.Helper();var winners atomic.Int32;var wg sync.WaitGroup;for i:=0;i<16;i++{wg.Add(1);go func(){defer wg.Done();ok,err:=fn();if err!=nil{t.Error("atomic operation failed")};if ok{winners.Add(1)}}()};wg.Wait();if winners.Load()!=1{t.Fatalf("expected one winner, got %d",winners.Load())}}
 race(func()(bool,error){return states.Consume(ctx,user,state.Version,6,"")})
 race(func()(bool,error){return states.Consume(ctx,user,state.Version,0,"synthetic-hash")})
 if ok,_:=states.Consume(ctx,user,"stale-version",7,"");ok{t.Fatal("version bypass")}
 pending:=auth.MFAChallenge{UserID:user,Email:"fixture@example.invalid",Version:state.Version}
 token,err:=challenges.Create(ctx,"login",pending);if err!=nil{t.Fatal("create challenge")}
 defer cache.Del(context.Background(),challengeStorageKey("login",token))
 if _,err:=challenges.Attempt(ctx,"enroll",token);!errors.Is(err,auth.ErrVerification){t.Fatal("purpose confusion")}
 ttl:=cache.TTL(ctx,challengeStorageKey("login",token)).Val();if ttl<290*time.Second||ttl>auth.MFAChallengeLifetime{t.Fatal("challenge TTL")}
 for i:=0;i<5;i++{if got,err:=challenges.Attempt(ctx,"login",token);err!=nil||got!=pending{t.Fatal("attempt budget")}}
 if _,err:=challenges.Attempt(ctx,"login",token);!errors.Is(err,auth.ErrVerification){t.Fatal("unbounded attempts")}
 token,_=challenges.Create(ctx,"login",pending)
 race(func()(bool,error){return challenges.Take(ctx,"login",token,pending)})
 token,_=challenges.Create(ctx,"login",pending);key:=challengeStorageKey("login",token);defer cache.Del(context.Background(),key)
 if cache.PExpire(ctx,key,time.Millisecond).Err()!=nil{t.Fatal("expire fixture")};time.Sleep(5*time.Millisecond)
 if _,err:=challenges.Attempt(ctx,"login",token);!errors.Is(err,auth.ErrVerification){t.Fatal("expired challenge")}
 if ok,err:=states.Disable(ctx,user,state.Version,"next");err!=nil||!ok{t.Fatal("disable CAS")};stored,err:=states.Load(ctx,user)
 if err!=nil||stored.Enabled||stored.Cipher!=""||len(stored.Recovery)>0||stored.Version!="next"{t.Fatal("disable retained secrets")}
}

// Match the public, hashed Redis namespace to verify the actual storage TTL.
func challengeStorageKey(purpose,token string)string{return "forgeharbor:auth:mfa:v1:"+purpose+":"+digestToken(token)}

func TestMFAEnrollmentLoginWithRealStores(t *testing.T){
 ctx,cancel:=context.WithTimeout(context.Background(),45*time.Second);defer cancel()
 client,err:=mongo.Connect(options.Client().ApplyURI(os.Getenv("MONGO_URI")));if err!=nil{t.Fatal(err)};defer client.Disconnect(context.Background())
 name:="fh_mfa_fixture_"+strings.ReplaceAll(platform.UUID(),"-","");db:=client.Database(name);defer db.Drop(context.Background())
 opts,err:=redis.ParseURL(os.Getenv("REDIS_URL"));if err!=nil{t.Fatal(err)};cache:=redis.NewClient(opts);defer cache.Close()
 key:=make([]byte,32);if _,err=rand.Read(key);err!=nil{t.Fatal(err)}
 mfa,err:=auth.NewMFA(auth.MongoMFA{Collection:db.Collection("users")},auth.RedisMFAChallenges{Client:cache},key);if err!=nil{t.Fatal(err)}
 service:=newMFAService(t,db,cache,mfa)
 req:=func(path,body,token string)*httptest.ResponseRecorder{r:=httptest.NewRequest("POST",path,strings.NewReader(body));r.Header.Set("Content-Type","application/json");if token!=""{r.Header.Set("Authorization","Bearer "+token)};w:=httptest.NewRecorder();service.Handler([]string{"http://localhost:3000"}).ServeHTTP(w,r);return w}
 decode:=func(w *httptest.ResponseRecorder)map[string]any{t.Helper();var data map[string]any;if json.Unmarshal(w.Body.Bytes(),&data)!=nil{t.Fatal("JSON response")};return data}
 body:=`{"email":"mfa-`+platform.UUID()+`@example.invalid","password":"synthetic fixture passphrase only"}`
 if req("/auth/signup",body,"").Code!=201{t.Fatal("signup")};w:=req("/auth/login",body,"");if w.Code!=200{t.Fatal("login")};old:=w.Result().Cookies()[0].Value
 w=req("/auth/mfa/setup",`{"password":"synthetic fixture passphrase only"}`,old);if w.Code!=200{t.Fatal("setup")};data:=decode(w)
 code,err:=totpCode(data["secret"].(string));if err!=nil{t.Fatal("TOTP fixture")};payload,_:=json.Marshal(map[string]any{"enrollment_token":data["enrollment_token"],"code":code})
 w=req("/auth/mfa/enable",string(payload),old);if w.Code!=200{t.Fatalf("enable %d",w.Code)};recovery:=decode(w)["recovery_codes"].([]any)[0].(string)
 w=req("/auth/login",body,"");if w.Code!=200||w.Result().Cookies()[0].Value!=""{t.Fatal("password bypass")};pending:=decode(w)["challenge_token"]
 payload,_=json.Marshal(map[string]any{"challenge_token":pending,"code":code});if req("/auth/mfa/verify",string(payload),"").Code!=401{t.Fatal("enrollment TOTP replay")}
 payload,_=json.Marshal(map[string]any{"challenge_token":pending,"code":recovery});w=req("/auth/mfa/verify",string(payload),"");if w.Code!=200||w.Result().Cookies()[0].Value==""{t.Fatal("recovery sign in")}
 if req("/auth/mfa/verify",string(payload),"").Code!=401{t.Fatal("challenge replay")}
 claims,_:=service.Tokens.Verify(old);stored,err:=mfa.States.Load(ctx,claims.Subject);if err!=nil||stored.Cipher==data["secret"]||len(stored.Recovery)!=9{t.Fatal("secret/recovery storage")}
}
