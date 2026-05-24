import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Sidebar from "@/app/components/Sidebar";
import NewCampaignForm from "./NewCampaignForm";

export default async function NewCampaignPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Fetch lookups
  const jurisdictions = await prisma.jurisdiction.findMany({ orderBy: { name: "asc" } });
  const vendors = await prisma.vendor.findMany({ orderBy: { name: "asc" } });
  const contracts = await prisma.contract.findMany({ select: { id: true, title: true, vendorId: true }, orderBy: { title: "asc" } });
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });

  // Serialize Decimal fields for client component compatibility
  const serializedProducts = products.map(p => ({ ...p, price: p.price ? parseFloat(p.price) : null, createdAt: p.createdAt.toISOString() }));
  const serializedJurisdictions = jurisdictions.map(j => ({ ...j, createdAt: j.createdAt.toISOString() }));
  const serializedVendors = vendors.map(v => ({ ...v, createdAt: v.createdAt.toISOString(), updatedAt: v.updatedAt.toISOString() }));

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h2>Create New Campaign</h2>
          <p>Initialize a new marketing campaign to track channels, assets, and milestones.</p>
        </div>
        <div className="page-body">
          <NewCampaignForm 
            jurisdictions={serializedJurisdictions} 
            vendors={serializedVendors} 
            contracts={contracts} 
            products={serializedProducts} 
          />
        </div>
      </main>
    </div>
  );
}
