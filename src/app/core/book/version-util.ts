import { ContentVersion } from '../db';

export interface VersionCreationResult {
  updatedVersions: ContentVersion[];
  newId: string;
}

export function createNewContentVersion(
  currentVersions: ContentVersion[],
  content: string,
  model: string,
  source: 'ai' | 'ai_edited' | 'manual' = 'ai'
): VersionCreationResult {
  if (!content.trim()) {
    return {
      updatedVersions: currentVersions,
      newId: ''
    };
  }

  const versions = [...currentVersions];
  const lastVersion = versions.length > 0 ? (versions[versions.length - 1].versionNumber ?? versions.length) : 0;
  const newId = Date.now().toString() + Math.random().toString(36).substring(2, 6);
  
  const newVersion: ContentVersion = {
    id: newId,
    versionNumber: lastVersion + 1,
    content,
    model,
    timestamp: Date.now(),
    source
  };
  
  versions.push(newVersion);
  if (versions.length > 3) {
    versions.shift(); // remove oldest
  }

  return {
    updatedVersions: versions,
    newId
  };
}
