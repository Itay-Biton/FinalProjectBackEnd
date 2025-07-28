import { Types } from "mongoose";

interface PetLike {
  _id?: string | Types.ObjectId;
  species?: string;
  breed?: string;
  age?: string;
  furColor?: string;
  eyeColor?: string;
  location?: {
    coordinates?: [number, number];
  };
}

/**
 * Computes a match score between a lost and found pet.
 * - Pets beyond `maxSearchRadiusKm` are assumed to be filtered out *before* calling this.
 * - Pets within `maxScoreRadiusKm` receive full location points; farther ones receive 0 for location.
 */
function computeMatchScore(
  lostPet: PetLike,
  foundPet: PetLike,
  maxScoreRadiusKm: number = 3
): number {
  if (
    !lostPet.species ||
    !foundPet.species ||
    lostPet.species.toLowerCase() !== foundPet.species.toLowerCase()
  ) {
    return 0; // Blocker: Species mismatch
  }

  let score = 0;

  // Breed
  if (lostPet.breed && foundPet.breed) {
    const breedA = lostPet.breed.toLowerCase();
    const breedB = foundPet.breed.toLowerCase();
    if (breedA === breedB) score += 4;
    else if (breedA.includes(breedB) || breedB.includes(breedA)) score += 2;
  }

  // Fur color
  if (
    lostPet.furColor &&
    foundPet.furColor &&
    lostPet.furColor.toLowerCase() === foundPet.furColor.toLowerCase()
  ) {
    score += 3;
  }

  // Eye color
  if (
    lostPet.eyeColor &&
    foundPet.eyeColor &&
    lostPet.eyeColor.toLowerCase() === foundPet.eyeColor.toLowerCase()
  ) {
    score += 2;
  }

  // Age (within ±1 year)
  if (lostPet.age && foundPet.age) {
    const a = parseFloat(lostPet.age);
    const b = parseFloat(foundPet.age);
    if (!isNaN(a) && !isNaN(b) && Math.abs(a - b) <= 1) score += 2;
  }

  // Distance-based points (only if within scoring radius)
  const distance = getGeoDistance(
    lostPet.location?.coordinates ?? [0, 0],
    foundPet.location?.coordinates ?? [0, 0]
  );

  if (distance <= maxScoreRadiusKm) {
    score += 6;
  }

  return score;
}

function getGeoDistance(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number]
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export { computeMatchScore, PetLike, getGeoDistance };
