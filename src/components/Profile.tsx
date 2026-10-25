"use client";

import { useRef, useState } from "react";
import { MAX_PHOTO_LENGTH, USERNAME_HINT, USERNAME_RULE, type Profile } from "@/game/leaderboard";
import { cloud } from "@/lib/cloud";

const PHOTO_SIZE = 96;

/** A player's picture, or the first letter of their name on a teal disc if there's none or it won't load. */
export function Avatar({ photo, name, size }: { photo: string; name: string; size: number }) {
  const [broken, setBroken] = useState<string | null>(null);
  return photo && broken !== photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="avatar"
      src={photo}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setBroken(photo)}
    />
  ) : (
    <span className="avatar avatar-letter" style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden="true">
      {(name[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** Centre-crop a picked image to a small square JPEG, so it fits in the profile document. */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PHOTO_SIZE;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  bitmap.close();
  for (const quality of [0.85, 0.7, 0.5]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= MAX_PHOTO_LENGTH) return url;
  }
  throw new Error("That picture is too detailed to use");
}

export default function ProfileEditor({ start, first }: { start: Profile; first: boolean }) {
  const [username, setUsername] = useState(start.username);
  const [photo, setPhoto] = useState(start.photo);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const valid = USERNAME_RULE.test(username);

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError(await cloud.saveProfile({ username, photo }));
    setSaving(false);
  };

  return (
    <div
      className="sheet-backdrop"
      // Keep taps and keys inside the editor from moving the chicken underneath.
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") cloud.closeProfile();
      }}
    >
      <form
        className="sheet"
        role="dialog"
        aria-label="Your profile"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <h2>{first ? "Pick a username" : "Your profile"}</h2>
        <p className="sheet-sub">{first ? "This is how you'll show up on the leaderboards." : "Shown next to your points on the leaderboards."}</p>

        <div className="sheet-photo">
          <Avatar photo={photo} name={username} size={88} />
          <div>
            <button type="button" onClick={() => file.current?.click()}>
              {photo ? "Change picture" : "Add picture"}
            </button>
            {photo && (
              <button type="button" onClick={() => setPhoto("")}>
                Remove
              </button>
            )}
          </div>
          <input
            ref={file}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                setPhoto(await shrink(f));
                setError(null);
              } catch (err) {
                setError((err as Error).message || "That picture can't be used");
              }
            }}
          />
        </div>

        <label className="sheet-field">
          <span>USERNAME</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.trim())}
            maxLength={16}
            autoComplete="nickname"
            autoCapitalize="off"
            spellCheck={false}
            autoFocus
            placeholder="hopper_42"
          />
          <small>{USERNAME_HINT}</small>
        </label>

        {error && <p className="sheet-error">{error}</p>}

        <div className="sheet-actions">
          <button type="button" onClick={() => cloud.closeProfile()}>
            {first ? "Later" : "Cancel"}
          </button>
          <button type="submit" className="primary" disabled={!valid || saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
