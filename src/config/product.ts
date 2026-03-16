export const PRODUCT_NAME = 'Co-Cut';

// Canonical Co-Cut storage/runtime identifiers.
export const PRODUCT_VISITED_STORAGE_KEY_PREFIX = 'cocut-visited:';
export const PRODUCT_PERSISTENCE_DB = 'cocut-projects';
export const PRODUCT_ASSET_DRAG_TYPE = 'application/cocut-asset';

// Compatibility-only Co-Edit identifiers kept for migration and stale local listeners.
// New writes should continue to use the Co-Cut names above.
export const LEGACY_PRODUCT_VISITED_STORAGE_KEY = 'coedit-visited';
export const LEGACY_PRODUCT_PERSISTENCE_DB = 'coedit-projects';
export const LEGACY_PRODUCT_ASSET_DRAG_TYPE = 'application/coedit-asset';

export function getProductVisitedStorageKey(userId: string): string {
  return `${PRODUCT_VISITED_STORAGE_KEY_PREFIX}${userId}`;
}

export function setAssetDragData(dataTransfer: DataTransfer, assetId: string): void {
  dataTransfer.setData(PRODUCT_ASSET_DRAG_TYPE, assetId);
  // Keep the old drag type during the rename transition so stale listeners still work.
  dataTransfer.setData(LEGACY_PRODUCT_ASSET_DRAG_TYPE, assetId);
}

export function getAssetDragId(dataTransfer: DataTransfer): string {
  return (
    dataTransfer.getData(PRODUCT_ASSET_DRAG_TYPE) ||
    dataTransfer.getData(LEGACY_PRODUCT_ASSET_DRAG_TYPE)
  );
}

export function hasAssetDragType(dataTransfer: DataTransfer): boolean {
  return (
    dataTransfer.types.includes(PRODUCT_ASSET_DRAG_TYPE) ||
    dataTransfer.types.includes(LEGACY_PRODUCT_ASSET_DRAG_TYPE)
  );
}
