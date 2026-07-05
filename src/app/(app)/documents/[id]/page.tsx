import { requireUser } from "@/server/auth/session";
import { DocumentEditor } from "@/features/editor/document-editor";

/**
 * Editor route. Authentication is enforced here (server-side); document-level
 * authorization is enforced by the API the client calls. Rendering is delegated
 * to the client `DocumentEditor` because the editor is inherently interactive
 * and local-first (IndexedDB + sync engine live in the browser).
 */
export default async function DocumentPage({
  params,
}: PageProps<"/documents/[id]">) {
  await requireUser();
  const { id } = await params;
  return <DocumentEditor documentId={id} />;
}
