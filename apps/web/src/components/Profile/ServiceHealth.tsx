import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { CheckCircle, AlertTriangle, ServerOff } from 'lucide-react';

import type { ServiceHealth as Health } from '../../types';

const ServiceHealth = () => {
    const [services, setServices] = useState<Health[]>([]);
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

    const getStatusInfo = (status: Health['status']) => {
        switch (status) {
            case 'healthy':
                return { icon: <CheckCircle className="w-5 h-5 text-green-700" />, text: "Healthy" };
            case 'unhealthy':
                return { icon: <AlertTriangle className="w-5 h-5 text-yellow-400" />, text: "Unhealthy" };
            default:
                return { icon: <ServerOff className="w-5 h-5 text-red-700" />, text: "Unavailable" };
        }
    };

    return (
        <div className="rounded-3xl p-8 shadow-2xl backdrop-blur-lg border bg-white border-slate-300">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Service Health Status</h2>
            {loading ? (
                <p className="text-slate-700">Checking service status...</p>
            ) : (
                <div className="service-health-grid">
                    {services.map(service => {
                        const { icon, text } = getStatusInfo(service.status);
                        return (
                            <div key={service.name} className="flex items-center space-x-3 bg-white p-3 rounded-lg">
                                {icon}
                                <div>
                                    <p className="capitalize font-medium text-slate-700">{service.name}</p>
                                    <p className="text-xs text-slate-600">{text}</p>
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
