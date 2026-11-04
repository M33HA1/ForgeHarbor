use actix_web::web;
use argon2::password_hash::{SaltString, rand_core::OsRng};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use std::sync::Arc;
use tokio::sync::Semaphore;

#[derive(Clone)]
pub struct PasswordJobs {
    slots: Arc<Semaphore>,
}

#[derive(Debug, PartialEq)]
pub enum PasswordError {
    Busy,
    Failed,
}

impl PasswordJobs {
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            slots: Arc::new(Semaphore::new(max_concurrent)),
        }
    }

    async fn run<T, F>(&self, work: F) -> Result<T, PasswordError>
    where
        T: Send + 'static,
        F: FnOnce() -> Result<T, ()> + Send + 'static,
    {
        let permit = self
            .slots
            .clone()
            .try_acquire_owned()
            .map_err(|_| PasswordError::Busy)?;
        web::block(move || {
            // Keep the permit with the actual CPU work even if HTTP disconnects
            // cancel the future awaiting it. Do not queue unlimited hash jobs.
            let _permit = permit;
            work()
        })
        .await
        .map_err(|_| PasswordError::Failed)?
        .map_err(|_| PasswordError::Failed)
    }

    pub async fn hash(&self, password: String) -> Result<String, PasswordError> {
        self.run(move || {
            let salt = SaltString::generate(&mut OsRng);
            Argon2::default()
                .hash_password(password.as_bytes(), &salt)
                .map(|hash| hash.to_string())
                .map_err(|_| ())
        })
        .await
    }

    pub async fn verify(
        &self,
        password: String,
        stored_hash: String,
    ) -> Result<bool, PasswordError> {
        self.run(move || {
            let hash = PasswordHash::new(&stored_hash).map_err(|_| ())?;
            Ok(Argon2::default()
                .verify_password(password.as_bytes(), &hash)
                .is_ok())
        })
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[actix_web::test]
    async fn argon2_round_trip_rejects_wrong_password_and_bad_hash() {
        let jobs = PasswordJobs::new(1);
        let password = "  fixture 🛟 passphrase  ".to_string();
        let hash = jobs.hash(password.clone()).await.unwrap();
        assert!(hash.starts_with("$argon2id$"));
        assert!(jobs.verify(password, hash.clone()).await.unwrap());
        assert!(
            !jobs
                .verify("wrong fixture password".into(), hash)
                .await
                .unwrap()
        );
        assert_eq!(
            jobs.verify("fixture".into(), "invalid hash".into()).await,
            Err(PasswordError::Failed)
        );
    }

    #[actix_web::test]
    async fn busy_pool_rejects_work_and_recovers_after_release() {
        let jobs = PasswordJobs::new(1);
        let permit = jobs.slots.clone().acquire_owned().await.unwrap();
        assert_eq!(
            jobs.hash("fixture password".into()).await,
            Err(PasswordError::Busy)
        );
        drop(permit);
        assert!(jobs.hash("fixture password".into()).await.is_ok());
    }

    #[actix_web::test]
    async fn cancelled_request_keeps_capacity_reserved_until_work_finishes() {
        let jobs = PasswordJobs::new(1);
        let worker = jobs.clone();
        let (started, running) = tokio::sync::oneshot::channel();
        let (finish, wait) = std::sync::mpsc::channel();
        let task = actix_web::rt::spawn(async move {
            worker
                .run(move || {
                    let _ = started.send(());
                    wait.recv().map_err(|_| ())
                })
                .await
        });
        running.await.unwrap();
        task.abort();
        assert_eq!(
            jobs.hash("fixture password".into()).await,
            Err(PasswordError::Busy)
        );
        finish.send(()).unwrap();
        tokio::time::timeout(std::time::Duration::from_secs(2), async {
            while jobs.slots.available_permits() == 0 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        assert!(jobs.hash("fixture password".into()).await.is_ok());
    }
}
