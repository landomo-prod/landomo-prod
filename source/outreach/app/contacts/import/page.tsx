"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PreviewContact {
  name: string;
  email: string;
  company?: string;
  tags?: string[];
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export default function ImportContactsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewContact[] | null>(null);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setResult(null);
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("/api/contacts/import?action=preview", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to parse CSV");
        setPreview(null);
        return;
      }

      const data = await res.json();
      setPreview(data.contacts);
      setPreviewErrors(data.errors || []);
      setPreviewTotal(data.total);
    } catch {
      setError("Network error while parsing CSV");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".csv")) {
      handleFile(f);
    } else {
      setError("Please upload a .csv file");
    }
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/contacts/import?action=confirm", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Import failed");
        return;
      }

      const data = await res.json();
      setResult(data);
      setPreview(null);
    } catch {
      setError("Network error during import");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setPreviewErrors([]);
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Import Contacts</h1>
        <Button variant="outline" asChild>
          <Link href="/contacts">Back to Contacts</Link>
        </Button>
      </div>

      {!preview && !result && (
        <Card>
          <CardContent className="pt-6">
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                Drag and drop a CSV file here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Required columns: name, email. Optional: company, tags
              </p>
              <Button
                variant="secondary"
                onClick={() => inputRef.current?.click()}
                disabled={loading}
              >
                {loading ? "Parsing..." : "Choose File"}
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{file?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {previewTotal} valid contact{previewTotal !== 1 ? "s" : ""}{" "}
                  found
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={loading || previewTotal === 0}>
                {loading ? "Importing..." : `Import ${previewTotal} Contacts`}
              </Button>
            </div>
          </div>

          {previewErrors.length > 0 && (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm dark:bg-yellow-900/20 dark:border-yellow-800">
              <p className="font-medium mb-1">
                {previewErrors.length} warning{previewErrors.length !== 1 ? "s" : ""}:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                {previewErrors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {previewErrors.length > 5 && (
                  <li>...and {previewErrors.length - 5} more</li>
                )}
              </ul>
            </div>
          )}

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-3">
                Preview (first {Math.min(10, preview.length)} rows):
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Tags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.slice(0, 10).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.email}</TableCell>
                      <TableCell>{c.company || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {(c.tags || []).map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.length > 10 && (
                <p className="text-xs text-muted-foreground mt-2">
                  ...and {preview.length - 10} more rows
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {result && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium">Import Complete</p>
                <p className="text-sm text-muted-foreground">
                  {result.imported} imported, {result.skipped} skipped
                </p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm dark:bg-yellow-900/20 dark:border-yellow-800">
                <p className="font-medium mb-1">Errors:</p>
                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <Button asChild>
                <Link href="/contacts">View Contacts</Link>
              </Button>
              <Button variant="outline" onClick={reset}>
                Import Another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
