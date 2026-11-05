// Only the browser regression bundle resolves Clerk here. No SDK/network is loaded.
// Clerk's hosted account menu is covered by separate credentialed QA, not this stub.
export function UserButton() {
  return <button type="button" aria-label="Cuenta de prueba">Cuenta</button>;
}
