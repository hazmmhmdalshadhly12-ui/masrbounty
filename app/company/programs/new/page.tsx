import { ProgramBuilderWizard } from '@/components/programs/program-builder/ProgramBuilderWizard';

export const metadata = {
  title: 'معالج إنشاء برنامج جديد | MasrBounty',
  description: 'أنشئ برنامج مكافآت الثغرات عبر معالج من ٨ خطوات — البيانات الأساسية، النطاق، القواعد، المكافآت، SLA، الإفصاح، المعاينة، والنشر',
};

export default function NewProgramPage() {
  return (
    <main className="container py-8 max-w-4xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">معالج إنشاء برنامج جديد</h1>
        <p className="mt-2 text-sm text-muted-foreground">٨ خطوات — من البيانات الأساسية حتى النشر والتحقق عبر checkPublishReadiness</p>
      </div>
      <ProgramBuilderWizard />
    </main>
  );
}
