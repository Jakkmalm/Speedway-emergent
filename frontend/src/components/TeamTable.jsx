// src/components/TeamTable.jsx
import React from "react";
import { Badge } from "./ui/badge";
import { Trophy } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "@/components/ui/table";

export default function TeamTable({ teams }) {
  return (
    <div className="overflow-x-auto">
      <Table className="w-full">
        <TableHeader>
          <TableRow className="border-b">
            <TableHead className="text-left py-3 px-4">Pos</TableHead>
            <TableHead className="text-left py-3 px-4">Lag</TableHead>
            <TableHead className="text-left py-3 px-4">Stad</TableHead>
            <TableHead className="text-right py-3 px-4">Matcher</TableHead>
            <TableHead className="text-right py-3 px-4">Poäng</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teams.map((team, index) => (
            <TableRow key={team.id} className="border-b hover:bg-accent">
              <TableCell className="py-3 px-4 font-medium">
                {index + 1}
                {index === 0 && (
                  <Trophy className="w-4 h-4 inline ml-2 text-yellow-600" />
                )}
              </TableCell>
              <TableCell className="py-3 px-4 font-semibold text-primary">
                {team.name}
              </TableCell>
              <TableCell className="py-3 px-4 text-gray-600">{team.city}</TableCell>
              <TableCell className="py-3 px-4 text-right">{team.matches_played}</TableCell>
              <TableCell className="py-3 px-4 text-right">
                <Badge variant={index < 3 ? "default" : "secondary"}>
                  {team.points}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan="5" className="text-center py-3">
              Totalt antal lag: {teams.length}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
