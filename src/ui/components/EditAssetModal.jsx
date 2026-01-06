import React, { useState, useEffect } from "react";
import { Loader2, X } from "lucide-react";

export default function EditAssetModal({
    isOpen,
    onClose,
    asset,
    reportId,
    onAssetUpdate
}) {
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isOpen && asset) {
            setForm({
                asset_name: asset.asset_name || "",
                final_value: asset.final_value || "",
                pg_no: asset.pg_no || "",
                inspection_date: asset.inspection_date || "",
                owner_name: asset.owner_name || "",
                region: asset.region || "",
                city: asset.city || ""
            });

            setError("");
        }
    }, [isOpen, asset]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        if (!asset?.internal_uid) {
            setError("Asset identifier missing.");
            return;
        }

        setSaving(true);
        setError("");

        try {
            await window.electronAPI.apiRequest(
                "PATCH",
                `/api/report/${reportId}/assets/${asset.internal_uid}`,
                form
            );

            if (onAssetUpdate) {
                onAssetUpdate();
            }

            onClose();
        } catch (err) {
            console.error("Save failed:", err);
            setError("Failed to update asset. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl">
                <div className="flex items-center justify-between border-b px-5 py-4">
                    <h2 className="text-lg font-semibold">Edit Asset</h2>
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    {error && (
                        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Asset name */}
                    <div>
                        <label className="text-sm font-medium">Asset Name</label>
                        <input
                            name="asset_name"
                            value={form.asset_name}
                            onChange={handleChange}
                            className="mt-1 w-full rounded-lg border px-3 py-2"
                        />
                    </div>

                    {/* Final value */}
                    <div>
                        <label className="text-sm font-medium">Final Value (whole number)</label>
                        <input
                            name="final_value"
                            value={form.final_value}
                            onChange={handleChange}
                            className="mt-1 w-full rounded-lg border px-3 py-2"
                        />
                    </div>

                    {/* Inspection Date */}
                    <div>
                        <label className="text-sm font-medium">Inspection Date</label>
                        <input
                            type="date"
                            name="inspection_date"
                            value={form.inspection_date}
                            onChange={handleChange}
                            className="mt-1 w-full rounded-lg border px-3 py-2"
                        />
                    </div>

                    {/* Owner Name */}
                    <div>
                        <label className="text-sm font-medium">Owner Name</label>
                        <input
                            name="owner_name"
                            value={form.owner_name}
                            onChange={handleChange}
                            className="mt-1 w-full rounded-lg border px-3 py-2"
                        />
                    </div>

                    {/* Location */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium">Region</label>
                            <input
                                name="region"
                                value={form.region}
                                onChange={handleChange}
                                className="mt-1 w-full rounded-lg border px-3 py-2"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">City</label>
                            <input
                                name="city"
                                value={form.city}
                                onChange={handleChange}
                                className="mt-1 w-full rounded-lg border px-3 py-2"
                            />
                        </div>
                    </div>
                </div>

                <div className="border-t px-5 py-4 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="rounded-lg border px-4 py-2 text-sm"
                        disabled={saving}
                    >
                        Cancel
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
