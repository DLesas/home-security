import { Repository, Schema } from "redis-om";
import { redis } from "./";

const schema = new Schema("sensor", {
  name: { type: "string" }, // the title of the song
  artist: { type: "string" }, // who performed the song
  genres: { type: "string[]" }, // array of strings for the genres of the song
  lyrics: { type: "text" }, // the full lyrics of the song
  music: { type: "text" }, // who wrote the music for the song
   // the year the song was releases
  building: { type: "string" }, 
  ipAddress: { type: "string" }, 
  macAddress: { type: "string" },
  date: { type: "date" },
});

export const songRepository = new Repository(schema, redis);

await songRepository.createIndex();
