const ROOM_CODE_PATTERN = /^[A-Z]{4}$/;
const ROOM_CODE_LENGTH = 4;
const ROOM_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidRoomCode(value: string): boolean {
  return ROOM_CODE_PATTERN.test(normalizeRoomCode(value));
}

function randomRoomCode(): string {
  let output = "";

  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    const randomIndex = Math.floor(Math.random() * ROOM_ALPHABET.length);
    output += ROOM_ALPHABET[randomIndex];
  }

  return output;
}

export function generateRoomCode(existingCodes: Set<string>, maxAttempts = 500): string {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = randomRoomCode();

    if (!existingCodes.has(code)) {
      return code;
    }
  }

  throw new Error("Unable to generate a unique room code.");
}
