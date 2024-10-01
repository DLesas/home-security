import { Request, Response, NextFunction } from "express";
import { db } from "../db/db.js";	
import { accessLogsTable } from "../db/schema/accessLogs.js";
import { errorLogsTable } from "../db/schema/errorLogs.js";
import { CustomError, raiseError } from "../errorHandling.js";

export const loggingMiddleware = async (req: Request, res: Response, next: NextFunction) => {
	const clientIp = req.ip!;
	try {
		console.log("recieved request, endpoint: ", req.baseUrl + req.path, "query: ", req.query, "body: ", req.body, "method: ", req.method, "clientIp: ", clientIp, "userAgent: ", req.headers["user-agent"]);
		await db.insert(accessLogsTable).values({
			endpoint: req.baseUrl + req.path,
			queryString: JSON.stringify(req.query),
			body: JSON.stringify(req.body),
			action: req.method as "GET" | "POST" | "DELETE" | "PUT",
			connection: "http",
			clientIp,
			userAgent: req.headers["user-agent"],
		});
		next();
	} catch (err) {
		console.error("Error in logging middleware:", err);
		next(err);
	}
};

export const errorHandler = async (err: Error, req: Request, res: Response, next: NextFunction) => {
	console.error(err.stack);

	let statusCode = 500;
	let message = "Internal server error";

	if (err instanceof CustomError) {
		statusCode = err.statusCode;
		message = err.message;
	}

	await db.insert(errorLogsTable).values({
		endpoint: req.baseUrl + req.path,
		errorTrace: err.stack || err.message || String(err),
	});
	res.status(statusCode).send({ status: "error", message });
};
