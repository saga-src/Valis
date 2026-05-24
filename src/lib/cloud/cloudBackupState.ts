let suppressed = false;

export function setCloudBackupSuppressed(value: boolean) {
  suppressed = value;
}

export function isCloudBackupSuppressed() {
  return suppressed;
}
