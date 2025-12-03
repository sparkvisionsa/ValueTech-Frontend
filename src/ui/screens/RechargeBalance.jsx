import React, { useState, useEffect } from 'react';
import { useSession } from '../context/SessionContext';

const RechargeBalance = () => {
    const { token } = useSession();
    const [totalPoints, setTotalPoints] = useState(0);
    const [subscriptions, setSubscriptions] = useState([]);

    useEffect(() => {
        fetchSubscriptions();
    }, []);

    const fetchSubscriptions = async () => {
        try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const response = await window.electronAPI.apiRequest('GET', '/api/packages/subscriptions', {}, headers);
            setTotalPoints(response.totalPoints);
            setSubscriptions(response.subscriptions);
        } catch (error) {
            console.error('Error fetching subscriptions');
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Recharge Balance</h1>
            <div className="mb-4">
                <div className="text-lg">Total Number of Points: {totalPoints}</div>
                <div className="text-lg">Total Balance: {totalPoints}</div>
            </div>
            <table className="w-full border-collapse border border-gray-300">
                <thead>
                    <tr>
                        <th className="border border-gray-300 p-2">Package Name</th>
                        <th className="border border-gray-300 p-2">Number of Points</th>
                    </tr>
                </thead>
                <tbody>
                    {subscriptions.map((sub) => (
                        <tr key={sub._id}>
                            <td className="border border-gray-300 p-2">{sub.packageId.name}</td>
                            <td className="border border-gray-300 p-2">{sub.packageId.points}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default RechargeBalance;
