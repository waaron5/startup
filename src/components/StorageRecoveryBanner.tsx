import { useMemo, useState } from "react";
import { STORAGE_KEYS } from "../constants/storageKeys";
import {
  getCorruptedStorageKeys,
  resetStorageKeys,
} from "../lib/storage";

const APP_STORAGE_KEYS = Object.values(STORAGE_KEYS);
const APP_STORAGE_KEY_SET = new Set<string>(APP_STORAGE_KEYS);

export default function StorageRecoveryBanner() {
  const [dismissed, setDismissed] = useState(false);
  const corruptedKeys = useMemo(
    () => getCorruptedStorageKeys().filter((key) => APP_STORAGE_KEY_SET.has(key)),
    []
  );

  if (dismissed || corruptedKeys.length === 0) {
    return null;
  }

  function handleResetStorage() {
    resetStorageKeys(APP_STORAGE_KEYS);
    window.location.reload();
  }

  return (
    <section className="card w-full max-w-3xl mx-auto mt-4 text-center">
      <h2 className="text-xl">Local Data Recovery</h2>
      <p className="text-text-muted mt-2">
        Some saved browser data could not be read and may be corrupted.
      </p>
      <p className="text-text-muted mt-1 text-sm">
        Affected keys: {corruptedKeys.join(", ")}
      </p>

      <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2">
        <button className="btn-danger" onClick={handleResetStorage} type="button">
          Reset Local Data
        </button>
        <button
          className="btn-ghost border border-white/20"
          onClick={() => setDismissed(true)}
          type="button"
        >
          Dismiss
        </button>
      </div>
    </section>
  );
}
