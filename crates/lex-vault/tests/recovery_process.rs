#![cfg(feature = "synthetic-recovery")]
//! Explicit child executable for synthetic tests only, feature-gated and not an app route.
use lex_vault::recovery::*;
use std::io::{Read, Write};
use zeroize::Zeroizing;
#[path = "support/recovery_fixture.rs"]
mod fixture;
fn read_part(reader: &mut impl Read, limit: usize) -> Result<Zeroizing<Vec<u8>>, RecoveryError> {
    let mut length = [0; 4];
    reader
        .read_exact(&mut length)
        .map_err(|_| RecoveryError::InvalidInput)?;
    let n = u32::from_be_bytes(length) as usize;
    if n > limit {
        return Err(RecoveryError::ResourceLimit);
    }
    let mut data = Zeroizing::new(vec![0; n]);
    reader
        .read_exact(&mut data)
        .map_err(|_| RecoveryError::InvalidInput)?;
    Ok(data)
}
fn run() -> Result<(), RecoveryError> {
    if std::env::args_os().len() != 1 {
        return Err(RecoveryError::InvalidInput);
    }
    let mut reader = std::io::stdin().lock();
    let mut mode = [0];
    reader
        .read_exact(&mut mode)
        .map_err(|_| RecoveryError::InvalidInput)?;
    let secret = read_part(&mut reader, 128)?;
    let expected_bytes = read_part(&mut reader, MAX_MANIFEST)?;
    let ciphertext = read_part(&mut reader, MAX_CIPHERTEXT + 1)?;
    let mut tail = [0];
    if reader
        .read(&mut tail)
        .map_err(|_| RecoveryError::InvalidInput)?
        != 0
    {
        return Err(RecoveryError::InvalidInput);
    }
    let expected = SyntheticRecoveryExpectation::from_private_bytes(&expected_bytes)?;
    let passphrase = if secret.is_empty() {
        None
    } else {
        Some(RecoveryPassphrase::from_private_bytes(&secret)?)
    };
    drop(secret);
    let at = match mode[0] {
        0 => RecoveryFailpoint::None,
        1 => RecoveryFailpoint::StagingCollision,
        _ => return Err(RecoveryError::InvalidInput),
    };
    let mut restored = restore_synthetic(&ciphertext, passphrase.as_ref(), &expected, at)?;
    restored.verify_readonly()?;
    let scope = fixture::scope().native()?;
    if restored.original(&scope, "document_a")?.as_deref() != Some(fixture::PDF)
        || restored.revision(&scope)? != 2
        || restored.search(&scope, "obligación", 10)?.len() != 1
        || restored
            .get(&scope, lex_vault::Kind::Note, "map_a")?
            .is_none()
    {
        return Err(RecoveryError::SourceIntegrity);
    }
    restored.close_and_reopen_readonly()?;
    restored.verify_readonly()?;
    let foreign = lex_vault::Scope::new("foreign", "matter_a", Some("thread_a"))
        .map_err(|_| RecoveryError::InvalidInput)?;
    if restored.original(&foreign, "document_a").is_ok() {
        return Err(RecoveryError::ScopeMismatch);
    }
    Ok(())
}
fn main() {
    std::panic::set_hook(Box::new(|_| {}));
    let result = std::panic::catch_unwind(run);
    let code = match result {
        Ok(Ok(())) => 0,
        Ok(Err(e)) => match e {
            RecoveryError::InvalidInput => 1,
            RecoveryError::MissingCredential => 2,
            RecoveryError::CannotDecrypt => 3,
            RecoveryError::UnsupportedFormat => 4,
            RecoveryError::ScopeMismatch => 5,
            RecoveryError::RevisionConflict => 6,
            RecoveryError::SourceNotQuiescent => 7,
            RecoveryError::SourceIntegrity => 8,
            RecoveryError::ResourceLimit => 9,
            RecoveryError::Cancelled => 10,
            RecoveryError::StorageFailure => 11,
            RecoveryError::UnsupportedBackend => 12,
        },
        Err(_) => 13,
    };
    let _ = std::io::stdout().lock().write_all(
        format!(
            "{{\"version\":1,\"categoryCode\":{code},\"capabilityPublished\":{}}}\n",
            code == 0
        )
        .as_bytes(),
    );
    if code != 0 {
        std::process::exit(2)
    }
}
