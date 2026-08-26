import "dotenv/config";
import { seedDatabase } from "./seed-logic";

seedDatabase()
  .then((result) => {
    console.log("\nLogin de teste (senha para todos: senha123):");
    console.log(`  Admin:      ${result.logins.admin}`);
    console.log(`  Gerente:    ${result.logins.gerente}`);
    console.log(`  Supervisor: ${result.logins.supervisor}`);
    console.log(`  Condutor:   ${result.logins.condutor}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
