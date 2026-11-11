//! H5b.2c synthetic-only: execute on a clean public macos-15 CI runner.
//! Do not run on the owner's Mac or attach a private/real-client database.
use lex_vault::{Error, KeyMaterial, Scope, SyntheticVault, Vault};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{sync::{Arc,Barrier},thread};

const NS: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const V1: &str = "11111111111111111111111111111111";
const V2: &str = "22222222222222222222222222222222";
const V3: &str = "33333333333333333333333333333333";
const CANARY: &str = "SYNTHETIC_PRIVATE_MAP_CANARY_762_ÁNGELES";
fn scope() -> Scope { Scope::new("firm_a","matter_a",None).unwrap() }
fn document(v:&mut Vault, s:&Scope, id:&str, expected:i64) -> (i64,String) {
    let bytes=format!("SYNTHETIC_DOCUMENT_FOR_{id}").into_bytes();
    let hash=format!("{:x}",Sha256::digest(&bytes));
    let payload=json!({"id":id,"workspaceId":"firm_a","matterId":"matter_a","threadId":null,"text":"solo datos ficticios"}).to_string();
    let rev=v.insert_document(s,id,&payload,&bytes,&[],expected).unwrap();
    (rev,hash)
}
fn marker(suffix:&str) -> String {format!("[[LEX_{NS}_{suffix}]]")}
fn entry(text:&str, suffix:&str)->Value {json!({"text":text,"marker":marker(suffix)})}
fn spec(id:&str,parent:Option<&str>, entries:Vec<Value>, sources:Vec<Value>)->String {
    json!({"namespace":NS,"versionId":id,"parentVersionId":parent,
        "serializationVersion":1,"entries":entries,"sources":sources}).to_string()
}
fn source(doc:&str, hash:&str)->Value {
    json!({"documentId":doc,"sourceVersion":"source_version_1","sha256":hash})
}
fn commit(v:&mut Vault,revision:i64,active:Option<&str>,data:&str)->i64 {
    v.commit_pseudonym_version(&scope(),revision,active,data).unwrap()
}
#[test]
fn schema4_remains_unchanged_and_refuses_5() {
    let key=KeyMaterial::generate().unwrap();
    let (old,mut old_v)=SyntheticVault::create(&key).unwrap();
    assert_eq!(old_v.revision(&scope()).unwrap(),0);
    assert!(matches!(old_v.get_active_pseudonym_version(&scope()),Err(Error::CannotOpen)));
    old_v.close().unwrap();
    assert!(old.reopen(Some(&key)).is_ok());
    assert!(matches!(old.reopen_with_pseudonym_maps(Some(&key)),Err(Error::CannotOpen)));

    let (fresh,mut v)=SyntheticVault::create_with_pseudonym_maps(&key).unwrap();
    assert_eq!(v.revision(&scope()).unwrap(),0);
    assert!(matches!(fresh.reopen(Some(&key)),Err(Error::CannotOpen)));
    assert!(fresh.reopen_with_pseudonym_maps(Some(&key)).is_ok());
    v.close().unwrap();
    assert!(matches!(v.get_active_pseudonym_version(&scope()),Err(Error::Closed)));
}
#[test]
fn reopen_keeps_composed_decomposed_unicode_byte_exact_and_metadata_only_audit() {
    let key=KeyMaterial::generate().unwrap();
    let (fixture,mut v)=SyntheticVault::create_with_pseudonym_maps(&key).unwrap();
    let (revision,hash)=document(&mut v,&scope(),"doc_a",0);
    let nfc="José Ángela";
    let nfd="Jose\u{301} A\u{301}ngela";
    assert_ne!(nfc.as_bytes(),nfd.as_bytes());
    let version=spec(V1,None,
        vec![entry(nfc,"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),entry(nfd,"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")],
        vec![source("doc_a",&hash)]);
    assert_eq!(commit(&mut v,revision,None,&version),revision+1);
    v.close().unwrap();
    let reopened=fixture.reopen_with_pseudonym_maps(Some(&key)).unwrap();
    let map=reopened.get_active_pseudonym_version(&scope()).unwrap().unwrap();
    assert_eq!(map.version_id,V1);
    assert_eq!(map.entries.len(),2);
    assert_eq!(map.entries[0].text.as_bytes(),nfc.as_bytes());
    assert_eq!(map.entries[1].text.as_bytes(),nfd.as_bytes());
    assert_eq!(map.sources[0].sha256,hash);
    let audits=reopened.list_pseudonym_audits(&scope(),10).unwrap();
    assert_eq!(audits.len(),1);
    let serialized=serde_json::to_string(&audits).unwrap();
    assert!(serialized.contains("\"action\":\"commit\""));
    assert!(!serialized.contains(nfc));
    assert!(!serialized.contains(nfd));
    assert!(!serialized.contains("doc_a"));
}
#[test]
fn real_sql_constraint_rolls_back_revision_registry_version_and_audit() {
    let key=KeyMaterial::generate().unwrap();
    let (_,mut v)=SyntheticVault::create_with_pseudonym_maps(&key).unwrap();
    let (r,hash)=document(&mut v,&scope(),"doc_a",0);
    let attempted=spec(V1,None,vec![entry(CANARY,"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")],
        vec![source("doc_a",&hash),source("doc_a",&hash)]);
    // The duplicate document FK join hits SQL's PRIMARY KEY after an inserted marker and advance.
    assert!(matches!(v.commit_pseudonym_version(&scope(),r,None,&attempted),Err(Error::Storage)));
    assert_eq!(v.revision(&scope()).unwrap(),r);
    assert!(v.get_active_pseudonym_version(&scope()).unwrap().is_none());
    assert!(v.list_pseudonym_audits(&scope(),10).unwrap().is_empty());
    let good=spec(V1,None,vec![entry(CANARY,"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")],
        vec![source("doc_a",&hash)]);
    assert_eq!(commit(&mut v,r,None,&good),r+1);
}
#[test]
fn two_concurrent_writers_only_one_wins() {
    let key=KeyMaterial::generate().unwrap();
    let (fixture,mut first)=SyntheticVault::create_with_pseudonym_maps(&key).unwrap();
    let second=fixture.reopen_with_pseudonym_maps(Some(&key)).unwrap();
    let barrier=Arc::new(Barrier::new(2));
    let one=barrier.clone();
    let a=thread::spawn(move||{
        let ver=spec(V1,None,vec![entry("A","aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")],vec![]);
        one.wait();
        first.commit_pseudonym_version(&scope(),0,None,&ver)
    });
    let two=barrier.clone();
    let b=thread::spawn(move||{
        let mut second=second;
        let ver=spec(V2,None,vec![entry("B","bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")],vec![]);
        two.wait();
        second.commit_pseudonym_version(&scope(),0,None,&ver)
    });
    let results=[a.join().unwrap(),b.join().unwrap()];
    assert_eq!(results.iter().filter(|r|r.is_ok()).count(),1);
    assert!(results.iter().any(|r|matches!(r,Err(Error::Conflict))));
    let v=fixture.reopen_with_pseudonym_maps(Some(&key)).unwrap();
    assert_eq!(v.revision(&scope()).unwrap(),1);
    assert_eq!(v.list_pseudonym_audits(&scope(),10).unwrap().len(),1);
}
#[test]
fn parent_exact_prefix_and_rollback_does_not_reuse_old_marker_or_version() {
    let key=KeyMaterial::generate().unwrap();
    let (_,mut v)=SyntheticVault::create_with_pseudonym_maps(&key).unwrap();
    let first=entry("Alfa","aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    let second=entry("Beta","bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    let third=entry("Gamma","cccccccccccccccccccccccccccccccc");
    assert_eq!(commit(&mut v,0,None,&spec(V1,None,vec![first.clone()],vec![])),1);
    let bad=spec(V2,Some(V1),vec![second.clone(),first.clone()],vec![]);
    assert!(matches!(v.commit_pseudonym_version(&scope(),1,Some(V1),&bad),Err(Error::InvalidInput)));
    assert_eq!(commit(&mut v,1,Some(V1),&spec(V2,Some(V1),vec![first.clone(),second.clone()],vec![])),2);
    assert_eq!(v.activate_pseudonym_version(&scope(),2,Some(V2),V1).unwrap(),3);
    assert_eq!(v.get_pseudonym_version(&scope(),V2).unwrap().unwrap().entries.len(),2);
    assert!(matches!(v.commit_pseudonym_version(&scope(),3,Some(V1),
        &spec(V3,Some(V1),vec![first.clone(),second.clone()],vec![])),Err(Error::Storage)));
    assert!(matches!(v.commit_pseudonym_version(&scope(),3,Some(V1),
        &spec(V2,Some(V1),vec![first.clone(),third.clone()],vec![])),Err(Error::Storage)));
    assert_eq!(commit(&mut v,3,Some(V1),
        &spec(V3,Some(V1),vec![first,third],vec![])),4);
    assert_eq!(v.list_pseudonym_audits(&scope(),10).unwrap().len(),4);
}
#[test]
fn wrong_firm_matter_thread_namespace_source_and_stale_cas_rejected() {
    let key=KeyMaterial::generate().unwrap();
    let (_,mut v)=SyntheticVault::create_with_pseudonym_maps(&key).unwrap();
    let (r,hash)=document(&mut v,&scope(),"doc_a",0);
    let data=spec(V1,None,vec![entry(CANARY,"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")],
        vec![source("doc_a",&hash)]);
    let foreign_firm=Scope::new("firm_b","matter_a",None).unwrap();
    let foreign_matter=Scope::new("firm_a","matter_b",None).unwrap();
    let foreign_thread=Scope::new("firm_a","matter_a",Some("thread_b")).unwrap();
    assert!(v.get_active_pseudonym_version(&foreign_firm).unwrap().is_none());
    assert!(v.get_active_pseudonym_version(&foreign_matter).unwrap().is_none());
    assert!(matches!(v.get_active_pseudonym_version(&foreign_thread),Err(Error::InvalidInput)));
    assert!(matches!(v.commit_pseudonym_version(&foreign_thread,0,None,&data),Err(Error::InvalidInput)));
    assert!(matches!(v.commit_pseudonym_version(&foreign_firm,0,None,&data),Err(Error::InvalidInput)));
    let bad_hash=spec(V1,None,vec![entry(CANARY,"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")],
        vec![source("doc_a",&"0".repeat(64))]);
    assert!(matches!(v.commit_pseudonym_version(&scope(),r,None,&bad_hash),Err(Error::InvalidInput)));
    assert_eq!(commit(&mut v,r,None,&data),r+1);
    assert!(matches!(v.commit_pseudonym_version(&scope(),r,None,&data),Err(Error::Conflict)));
    assert!(matches!(v.activate_pseudonym_version(&scope(),r,None,V1),Err(Error::Conflict)));
    assert_eq!(v.get_pseudonym_version(&foreign_firm,V1).unwrap().is_none(),true);
    let other=Scope::new("firm_a","matter_b",None).unwrap();
    let other_spec=spec(V2,None,vec![entry("Otra","bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")],vec![]);
    assert!(matches!(v.commit_pseudonym_version(&other,0,None,&other_spec),Err(Error::Storage)));
    assert_eq!(v.revision(&other).unwrap(),0);
}
#[test]
fn malformed_unknown_fields_duplicate_markers_and_utf16_boundary_fail_closed() {
    let key=KeyMaterial::generate().unwrap();
    let (_,mut v)=SyntheticVault::create_with_pseudonym_maps(&key).unwrap();
    let base=spec(V1,None,vec![entry("Alfa","aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")],vec![]);
    let mut unknown:Value=serde_json::from_str(&base).unwrap();
    unknown["externalProvider"]=json!("forbidden");
    assert!(matches!(v.commit_pseudonym_version(&scope(),0,None,&unknown.to_string()),Err(Error::InvalidInput)));
    let mut unknown_entry:Value=serde_json::from_str(&base).unwrap();
    unknown_entry["entries"][0]["extra"]=json!(true);
    assert!(matches!(v.commit_pseudonym_version(&scope(),0,None,&unknown_entry.to_string()),Err(Error::InvalidInput)));
    let duplicates=spec(V1,None,vec![entry("Alfa","aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
        entry("Beta","aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")],vec![]);
    assert!(matches!(v.commit_pseudonym_version(&scope(),0,None,&duplicates),Err(Error::InvalidInput)));
    let too_long=spec(V1,None,vec![entry(&"🧑".repeat(513),"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")],vec![]);
    assert!(matches!(v.commit_pseudonym_version(&scope(),0,None,&too_long),Err(Error::InvalidInput)));
    let boundary=spec(V1,None,vec![entry(&"🧑".repeat(512),"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")],vec![]);
    assert_eq!(commit(&mut v,0,None,&boundary),1);
    assert_eq!(v.revision(&scope()).unwrap(),1);
}
#[test]
fn caps_256_entries_and_64_versions_are_enforced() {
    let key=KeyMaterial::generate().unwrap();
    let (_,mut v)=SyntheticVault::create_with_pseudonym_maps(&key).unwrap();
    let many:Vec<Value>=(0..257).map(|i|entry(&format!("entity{i}"),&format!("{i:032x}"))).collect();
    assert!(matches!(v.commit_pseudonym_version(&scope(),0,None,
        &spec(V1,None,many,vec![])),Err(Error::InvalidInput)));
    let mut rev=0;
    let mut active=None::<String>;
    let entries=vec![entry("Alfa","aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")];
    for i in 0..64 {
        let id=format!("{:032x}",i+1);
        let payload=spec(&id,active.as_deref(),entries.clone(),vec![]);
        rev=commit(&mut v,rev,active.as_deref(),&payload);
        active=Some(id);
    }
    let next=spec("ffffffffffffffffffffffffffffffff",active.as_deref(),entries,vec![]);
    assert!(matches!(v.commit_pseudonym_version(&scope(),rev,active.as_deref(),&next),Err(Error::InvalidInput)));
    assert_eq!(v.revision(&scope()).unwrap(),rev);
    assert_eq!(v.list_pseudonym_audits(&scope(),100).unwrap().len(),64);
}
#[test]
fn encrypted_database_and_journal_canary_scan_with_positive_control() {
    let key=KeyMaterial::generate().unwrap();
    let (f,mut v)=SyntheticVault::create_with_pseudonym_maps(&key).unwrap();
    let data=spec(V1,None,vec![entry(CANARY,"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")],vec![]);
    assert_eq!(commit(&mut v,0,None,&data),1);
    v.close().unwrap();
    let plain_control=tempfile::tempdir().unwrap();
    let plaintext=plain_control.path().join("control.txt");
    std::fs::write(&plaintext,CANARY.as_bytes()).unwrap();
    let bytes=std::fs::read(plaintext).unwrap();
    assert!(bytes.windows(CANARY.as_bytes().len()).any(|w|w==CANARY.as_bytes()));
    for (name,mode,bytes) in f.artifacts().unwrap() {
        assert_eq!(mode,0o600,"unexpected file mode");
        assert!(name.starts_with("vault.sqlite"),"unexpected artifact");
        assert!(!bytes.starts_with(b"SQLite format 3\0"));
        assert!(!bytes.windows(CANARY.as_bytes().len()).any(|w|w==CANARY.as_bytes()));
    }
    assert!(f.reopen_with_pseudonym_maps(None).is_err());
    let wrong=KeyMaterial::generate().unwrap();
    assert!(f.reopen_with_pseudonym_maps(Some(&wrong)).is_err());
    assert!(f.reopen_with_pseudonym_maps(Some(&key)).is_ok());
}
