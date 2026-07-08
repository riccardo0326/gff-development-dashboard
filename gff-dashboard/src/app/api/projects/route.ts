import { NextResponse } from "next/server";
import { getVehicleProjects } from "@/lib/queries";

export async function GET() {
  return NextResponse.json(getVehicleProjects());
}
