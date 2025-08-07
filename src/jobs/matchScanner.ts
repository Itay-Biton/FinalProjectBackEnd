import cron from "node-cron";
import Pet from "../models/Pet";
import {
  computeMatchScore,
  PetLike,
  getGeoDistance,
} from "../utils/matchAlgorithm";
import sendNotification from "../utils/sendNotification";

const MATCH_THRESHOLD = 7;
const MAX_SEARCH_RADIUS_KM = 10; // Only consider found pets within this distance

async function scanForLostFoundMatches() {
  const lostPets = await Pet.find({ isLost: true, isFound: false });
  const foundPets = await Pet.find({ isLost: false, isFound: true });

  for (const lostPet of lostPets) {
    for (const foundPet of foundPets) {
      const lostCoords = lostPet.location?.coordinates?.coordinates ?? [0, 0];
      const foundCoords = foundPet.location?.coordinates?.coordinates ?? [0, 0];

      const distance = getGeoDistance(
        [lostCoords[0], lostCoords[1]] as [number, number],
        [foundCoords[0], foundCoords[1]] as [number, number]
      );

      if (distance > MAX_SEARCH_RADIUS_KM) continue;

      const score = computeMatchScore(
        lostPet.toObject() as PetLike,
        foundPet.toObject() as PetLike
      );

      if (score >= MATCH_THRESHOLD) {
        console.log(
          `Match score ${score} between lost:${lostPet._id} and found:${foundPet._id}`
        );

        // Save match to lostPet's matchResults
        lostPet.matchResults = lostPet.matchResults || [];

        const alreadyMatched = lostPet.matchResults.some(
          (m) => m.petId?.toString() === foundPet._id?.toString()
        );
        if (!alreadyMatched) {
          lostPet.matchResults.push({
            petId: foundPet._id,
            score,
            matchedAt: new Date(),
          });
        }

        // Notify the owner of the lost pet
        await sendNotification({
          userId: lostPet.ownerId.toString(),
          title: "Possible Match Found",
          message: `We may have found your lost pet!\nCall ${foundPet.phoneNumbers}`,
          matchPetId: foundPet._id?.toString(),
        });
      }
    }
  }
}

// Cron: runs every hour
cron.schedule("0 * * * *", async () => {
  console.log("Running lost/found pet match scan...");
  await scanForLostFoundMatches();
});
