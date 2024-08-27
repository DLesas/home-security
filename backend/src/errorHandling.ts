export class CustomError extends Error {
	constructor(public statusCode: number, message: string) {
		super(message);
		this.name = "CustomError";
	}
}

export function raiseError(statusCode: number, message: string) {
	throw new CustomError(statusCode, message);
}
