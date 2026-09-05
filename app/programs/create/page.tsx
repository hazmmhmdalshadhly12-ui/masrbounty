import { redirect } from 'next/navigation';

// Program creation lives in the company area (membership-checked there).
export default function CreateProgramAlias() {
  redirect('/company/programs/new');
}
