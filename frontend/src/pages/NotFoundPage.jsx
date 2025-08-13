// src/pages/NotFoundPage.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center text-center">
      <h1 className="text-3xl font-bold mb-2">404 – Sidan finns inte</h1>
      <p className="text-gray-600 mb-4">
        Kontrollera länken eller gå tillbaka till startsidan.
      </p>
      <Link
        to="/"
        className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
      >
        Till startsidan
      </Link>
    </div>
  );
}
