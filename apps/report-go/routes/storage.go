package routes

import (
	"context"
	"errors"
	"net/url"
	"os"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Compatible mode preserves local RustFS configuration. AWS mode uses the SDK
// credential chain (including refreshing role credentials) and a precreated bucket.
func newReportStorage(ctx context.Context) (*s3.Client, string, bool, error) {
	mode := os.Getenv("S3_MODE")
	if mode == "" {
		mode = "compatible"
	}
	if mode != "compatible" && mode != "aws" {
		return nil, "", false, errors.New("S3_MODE must be compatible or aws")
	}
	bucket := strings.TrimSpace(os.Getenv("S3_BUCKET"))
	if bucket == "" {
		return nil, "", false, errors.New("S3_BUCKET is required")
	}
	endpoint := os.Getenv("S3_ENDPOINT")
	region := strings.TrimSpace(os.Getenv("S3_REGION"))
	opts := []func(*config.LoadOptions) error{}
	if mode == "compatible" {
		u, err := url.Parse(endpoint)
		if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") ||
			u.User != nil || (u.Path != "" && u.Path != "/") || u.RawQuery != "" || u.Fragment != "" {
			return nil, "", false, errors.New("S3_ENDPOINT must be an HTTP(S) origin")
		}
		if os.Getenv("S3_ACCESS_KEY") == "" || os.Getenv("S3_SECRET_KEY") == "" {
			return nil, "", false, errors.New("compatible storage requires both S3 credentials")
		}
		if region == "" {
			region = "us-east-1"
		}
		opts = append(opts, config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			os.Getenv("S3_ACCESS_KEY"), os.Getenv("S3_SECRET_KEY"), os.Getenv("S3_SESSION_TOKEN"),
		)))
	} else {
		// Refuse accidental reuse of the local config when selecting an AWS role.
		for _, key := range []string{"S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_SESSION_TOKEN", "AWS_ENDPOINT_URL", "AWS_ENDPOINT_URL_S3"} {
			if os.Getenv(key) != "" {
				return nil, "", false, errors.New("AWS mode cannot use custom endpoints or S3 credentials")
			}
		}
	}
	if region != "" {
		opts = append(opts, config.WithRegion(region))
	}
	cfg, err := config.LoadDefaultConfig(ctx, opts...)
	if err != nil {
		return nil, "", false, errors.New("report storage SDK configuration failed")
	}
	if cfg.Region == "" {
		return nil, "", false, errors.New("AWS storage requires an explicit region")
	}
	if _, err := cfg.Credentials.Retrieve(ctx); err != nil {
		return nil, "", false, errors.New("report storage credentials unavailable")
	}
	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		// Override shared-profile endpoint settings as well: AWS requests must use
		// the regional resolver; role credentials must never reach a local endpoint.
		o.BaseEndpoint = nil
		o.UsePathStyle = mode == "compatible"
		if mode == "compatible" {
			o.BaseEndpoint = aws.String(strings.TrimRight(endpoint, "/"))
		}
	})
	return client, bucket, mode == "compatible", nil
}

func initializeReportBucket(ctx context.Context, client *s3.Client, bucket string, allowCreate bool) error {
	return ensureReportBucket(ctx,
		func(ctx context.Context) error {
			_, err := client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(bucket)})
			return err
		},
		func(ctx context.Context) error {
			if !allowCreate {
				return errors.New("report bucket must be provisioned before startup")
			}
			_, err := client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(bucket)})
			return err
		},
	)
}
