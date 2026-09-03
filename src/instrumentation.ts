/**
 * Next.js instrumentation hook - runs once on server startup.
 * Automatically migrates and seeds the database.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { migrateDatabase } = await import("./db/migrate");
      const { seedDatabase } = await import("./db/seed");
      const { ensureDefaultAdminAccount } = await import("./services/employeeAuth");
      await migrateDatabase();
      await seedDatabase();
      await ensureDefaultAdminAccount();
      console.log("✅ Database ready.");
    } catch (err) {
      console.error("❌ Database init failed:", err);
      // Fail startup so deployment health checks can trigger an app rollback.
      throw err;
    }
  }
}
