"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MoreVertical, FileText, MapPin, Users, Calendar, Archive, Pencil, UserPlus } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProjectWithRole } from "@/lib/types/project";

interface ProjectCardProps {
  project: ProjectWithRole;
  onEdit: (project: ProjectWithRole) => void;
  onInvite: (project: ProjectWithRole) => void;
  onArchive: (project: ProjectWithRole) => void;
}

export function ProjectCard({ project, onEdit, onInvite, onArchive }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const tc = useTranslations("common");
  const tp = useTranslations("projects");
  const isMember = project.role === "owner" || project.role === "member";
  const isOwner = project.role === "owner";
  const isViewer = project.role === "viewer";

  const formattedDate = new Date(project.updated_at).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/dashboard/projects/${project.id}`}
            className="group flex-1 min-w-0"
          >
            <h3 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors line-clamp-2">
              {project.name}
            </h3>
          </Link>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 -mt-1 -mr-2">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">{tc("options")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isMember && (
                <>
                  {isOwner && (
                    <DropdownMenuItem onClick={() => { setMenuOpen(false); onEdit(project); }}>
                      <Pencil className="mr-2 h-4 w-4" />
                      {tc("edit")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => { setMenuOpen(false); onInvite(project); }}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    {tp("invite.title")}
                  </DropdownMenuItem>
                  {isOwner && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => { setMenuOpen(false); onArchive(project); }}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        {tp("archiveConfirm.submit")}
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}
              {!isMember && (
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/projects/${project.id}`}>
                    {tp("open")}
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Badge variant="secondary" className="w-fit text-xs mt-1">
          {isViewer ? tp("viewer") : project.role === "owner" ? tp("owner") : tp("member")}
        </Badge>
      </CardHeader>

      <CardContent className="flex-1 pb-2">
        {project.description ? (
          <p className="text-sm text-muted-foreground line-clamp-3">{project.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">{tp("noDescription")}</p>
        )}
      </CardContent>

      <CardFooter className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
        <span className="flex items-center gap-1">
          <FileText className="h-3.5 w-3.5" />
          {project.pdf_count ?? 0}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {project.marker_count ?? 0}
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {project.member_count ?? 0}
        </span>
        <span className="flex items-center gap-1 ml-auto">
          <Calendar className="h-3.5 w-3.5" />
          {formattedDate}
        </span>
      </CardFooter>
    </Card>
  );
}
