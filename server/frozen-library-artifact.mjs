// One frozen release identity. Changing the edition requires a separate reviewed code change.
import {readFile} from 'node:fs/promises';
import {regularFile,fileDigest} from './desktop-target.mjs';
export const FROZEN_LIBRARY_FILES=Object.freeze(['resources/public-library.sqlite','resources/public-library.sqlite.manifest.json']);
export const FROZEN_LIBRARY_IDENTITY=Object.freeze({manifestSha256:'20a8095d148e61349dfac99c2127ae14a9b3dc35a9e154681d51e1647839bed1',indexSha256:'ec944a19d40be5faa0bd0ee081e906145038446aa8df394b706adc2daddd1588',corpusSha256:'e97adb6bda336c1dac25c0369a6553977fae3993384bdb20c9acbeaf6f052c11',bytes:153014272});
export function assertFrozenLibraryManifest(manifest,digest,identity=FROZEN_LIBRARY_IDENTITY){
 if(manifest.schemaVersion!==1||manifest.kind!=='public-legal-library'||manifest.privateDocumentsIncluded!==false||manifest.status!=='structurally-verified-currentness-unverified'||! /^[a-f0-9]{64}$/.test(manifest.indexSha256)||! /^[a-f0-9]{64}$/.test(manifest.corpusSha256)||!Number.isSafeInteger(manifest.bytes)||manifest.bytes<=0||manifest.bytes>1024**3)throw Error('Manifiesto de biblioteca congelada inválido.');
 if(digest.sha256!==identity.manifestSha256||manifest.indexSha256!==identity.indexSha256||manifest.corpusSha256!==identity.corpusSha256||manifest.bytes!==identity.bytes)throw Error('Manifiesto distinto de la edición congelada; no se admite otra pareja autoconsistente.');
}
// Factory is a test seam for tiny synthetic artifacts, not a CLI/environment option.
export function createFrozenLibraryVerifier(identity){
 const pinned=Object.freeze({...identity});
 return async function(root){
  const [database,manifestPath]=FROZEN_LIBRARY_FILES,manifestFile=await regularFile(root,manifestPath),manifestDigest=await fileDigest(manifestFile);
  const manifest=JSON.parse(await readFile(manifestFile,'utf8'));
  assertFrozenLibraryManifest(manifest,manifestDigest,pinned);
  const source=await regularFile(root,database),digest=await fileDigest(source);
  if(digest.bytes!==pinned.bytes||digest.sha256!==pinned.indexSha256)throw Error('La biblioteca congelada no coincide con su manifiesto; restaura el artefacto exacto, no reconstruyas otra edición.');
  return [{path:database,source,...digest},{path:manifestPath,source:manifestFile,...manifestDigest}];
 };
}
export const frozenLibraryInventory=createFrozenLibraryVerifier(FROZEN_LIBRARY_IDENTITY);
