import React from "react";
import { X } from "lucide-react"; // Add X icon import

const InsufficientPointsModal = ({ viewChange, onClose }) => {
    return (
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative border border-gray-200">
            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Close"
            >
                <X className="w-4 h-4 text-gray-500" />
            </button>

            <h3 className="text-lg font-semibold text-gray-900 pr-6">
                You don't have enough points
            </h3>

            <p className="mt-2 text-sm text-gray-600">
                Please purchase a package to continue.
            </p>

            <div className="mt-5 flex gap-3">
                <button
                    className="flex-1 rounded-xl px-4 py-2 font-medium border border-gray-300 hover:bg-gray-50 transition"
                    onClick={onClose}
                >
                    Cancel
                </button>
                <button
                    className="flex-1 rounded-xl px-4 py-2 font-medium bg-blue-600 text-white hover:bg-blue-700 transition"
                    onClick={() => {
                        onClose(); // Close modal first
                        viewChange("packages"); // Then navigate
                    }}
                >
                    Go to Packages
                </button>
            </div>
        </div>
    );
};

export default InsufficientPointsModal;