import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { CheckCircle, AlertTriangle, ServerOff } from 'lucide-react';

const ServiceHealth = () => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHealth = async () => {
            setLoading(true);
            try {
                const healthData = await api.checkServiceHealth();
                setServices(healthData);
            } catch (error) {
                console.error("Failed to fetch service health:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchHealth();
    }, []);

    const getStatusInfo = (status) => {
        switch (status) {
            case 'healthy':
                return { icon: <CheckCircle className="w-5 h-5 text-green-400" />, text: "Healthy" };
            case 'unhealthy':
                return { icon: <AlertTriangle className="w-5 h-5 text-yellow-400" />, text: "Unhealthy" };
            default:
                return { icon: <ServerOff className="w-5 h-5 text-red-400" />, text: "Unavailable" };
        }
    };

    return (
        <div className="rounded-3xl p-8 shadow-2xl backdrop-blur-lg border bg-slate-800/40 border-slate-700/50">
            <h2 className="text-2xl font-bold text-white mb-6">Service Health Status</h2>
            {loading ? (
                <p className="text-slate-300">Checking service status...</p>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {services.map(service => {
                        const { icon, text } = getStatusInfo(service.status);
                        return (
                            <div key={service.name} className="flex items-center space-x-3 bg-slate-700/50 p-3 rounded-lg">
                                {icon}
                                <div>
                                    <p className="capitalize font-medium text-slate-300">{service.name}</p>
                                    <p className="text-xs text-slate-400">{text}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ServiceHealth;