import { type NextRequest, NextResponse } from "next/server";

export default async function middleware(req: NextRequest) {
  return NextResponse.next();
}


// public: auth/login, auth/sign-up
// semi-private: auth/verify-email