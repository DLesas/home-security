import { io } from "../index";

export async function emitNewData() {
	io.emit("newData", new Date());
}
