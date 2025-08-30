import React from 'react';
import { Link } from 'react-router-dom';
import { Card, Button } from '../components/ui';

const NotFoundPage: React.FC = () => {
    return (
        <div className="flex items-center justify-center py-20">
            <Card className="text-center max-w-lg">
                <h1 className="text-8xl font-orbitron font-black text-indigo-500">404</h1>
                <h2 className="text-3xl font-bold text-white mt-4">Page Not Found</h2>
                <p className="text-slate-400 mt-2">The page you're looking for doesn't exist or has been moved.</p>
                <Link to="/" className="mt-6 inline-block">
                    <Button variant="primary">Go Back Home</Button>
                </Link>
            </Card>
        </div>
    );
};

export default NotFoundPage;
