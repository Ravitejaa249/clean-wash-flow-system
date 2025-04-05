
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import Logo from '@/components/Logo';

const StudentDashboard = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="w-full py-4 px-4 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Logo />
          <Button
            variant="outline"
            onClick={handleLogout}
            className="text-sm"
          >
            Logout
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Student Dashboard</h1>
          <p className="text-gray-600 mb-8">
            Welcome to your dashboard. Here you can place new laundry orders and track existing ones.
          </p>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <p className="text-center text-gray-500">
              Student dashboard functionality will be implemented based on requirements.
            </p>
          </div>
        </div>
      </main>

      <footer className="py-6 px-4 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} CleanWash. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default StudentDashboard;
