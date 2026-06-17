import Navigation from '@/components/Navigation';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-white dark:bg-gray-950">
      <Navigation />
      
      {/* Content wrapper with left padding on desktop to clear sidebar */}
      <div className="md:pl-64">
        {/* On mobile, add bottom padding to clear bottom nav. Using 0 on desktop since sidebar doesn't overlap bottom */}
        <div className="mobile-content-container pb-20 md:pb-0 min-h-screen flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}
