import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, FolderOpen, Loader2, Save, TerminalSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { codexClient } from '@/api/clients/codexClient';

export default function AgentSkillEditor({ planData }) {
  const navigate = useNavigate();
  const recordId = planData?.recordId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [skillDir, setSkillDir] = useState('');
  const [settings, setSettings] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedPath, setSelectedPath] = useState('SKILL.md');
  const [content, setContent] = useState('');

  const selectedFile = useMemo(
    () => files.find((file) => file.relativePath === selectedPath) || null,
    [files, selectedPath]
  );

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!recordId) return;
      setLoading(true);
      setError('');
      try {
        const response = await codexClient.getSkillFiles(recordId);
        if (!mounted) return;
        const nextFiles = Array.isArray(response.files) ? response.files : [];
        const firstPath =
          nextFiles.find((file) => file.relativePath === 'SKILL.md')?.relativePath ||
          nextFiles[0]?.relativePath ||
          'SKILL.md';
        setSkillDir(response.skillDir || '');
        setSettings(response.settings || null);
        setFiles(nextFiles);
        setSelectedPath(firstPath);
        setContent(nextFiles.find((file) => file.relativePath === firstPath)?.content || '');
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError?.message || 'Failed to load Codex skill files.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [recordId]);

  useEffect(() => {
    setContent(selectedFile?.content || '');
  }, [selectedFile?.content]);

  const handleSelectFile = (relativePath) => {
    setSelectedPath(relativePath);
  };

  const handleSave = async () => {
    if (!recordId || !selectedPath) return;
    setSaving(true);
    try {
      const response = await codexClient.updateSkillFile(recordId, {
        relativePath: selectedPath,
        content,
      });
      const nextFiles = Array.isArray(response.files) ? response.files : files;
      setFiles(nextFiles);
      toast.success('Codex skill file saved');
      navigate('/dashboard/skills');
    } catch (saveError) {
      toast.error(saveError?.message || 'Failed to save Codex skill file');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-600">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading Codex skill...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => navigate('/dashboard/skills')}
        className="text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Skills
      </Button>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-violet-50 p-3 text-violet-700">
            <TerminalSquare className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {planData?.title || 'CloudAgent Skill'}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Edit the agent skill files used when this CloudAgent skill is handed off to an external agent.
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save and Return
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="h-4 w-4" />
            Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <div className="font-medium text-gray-700">Skill directory</div>
            <div className="mt-1 break-all rounded border bg-gray-50 px-3 py-2 font-mono text-xs">
              {skillDir}
            </div>
          </div>
          <div>
            <div className="font-medium text-gray-700">Run workspace</div>
            <div className="mt-1 break-all rounded border bg-gray-50 px-3 py-2 font-mono text-xs">
              {settings?.workspaceDir || ''}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {files.map((file) => (
              <button
                key={file.relativePath}
                type="button"
                onClick={() => handleSelectFile(file.relativePath)}
                className={`w-full rounded border px-3 py-2 text-left font-mono text-xs ${
                  selectedPath === file.relativePath
                    ? 'border-violet-300 bg-violet-50 text-violet-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {file.relativePath}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-mono">{selectedPath}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-[560px] resize-y font-mono text-sm"
              spellCheck={false}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
