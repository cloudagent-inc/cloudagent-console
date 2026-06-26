import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Loader2 } from 'lucide-react';

import BlueprintBuilder from './BlueprintBuilder';
import { fetchBlueprintById } from '../../features/blueprint/blueprintSlice';

function safeParseJSON(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export default function BlueprintBuilderEdit({ source = 'custom' }) {
  const { recordId, planId } = useParams();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [planData, setPlanData] = useState(null);
  const [error, setError] = useState(null);
  const isLibrarySource = source === 'library';

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        let nextPlanData = null;

        if (isLibrarySource) {
          if (!planId) return;

          const response = await fetch(
            `https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/plans/${planId}.json`
          );
          if (!response.ok) {
            throw new Error(
              `Failed to load library blueprint (${response.status} ${response.statusText})`
            );
          }

          const result = await response.json();
          const descriptionParsed = safeParseJSON(result.description, result.description);
          const requiredPermissionsParsed = safeParseJSON(
            result.requiredPermissions,
            {}
          );
          const planSettingsParsed = safeParseJSON(result.planSettings, {});

          nextPlanData = {
            id: planId,
            title: result.title,
            description: descriptionParsed || [],
            plan: Array.isArray(result.plan) ? result.plan : [],
            requiredPermissions: requiredPermissionsParsed || {},
            planSettings: planSettingsParsed || {},
            credits: result.credits,
          };
        } else {
          if (!recordId) return;

          const result = await dispatch(fetchBlueprintById(recordId)).unwrap();
          const descriptionParsed = safeParseJSON(result.description, result.description);
          const planParsed = safeParseJSON(result.plan, {});
          const requiredPermissionsParsed = safeParseJSON(result.requiredPermissions, {});
          const planSettingsParsed = safeParseJSON(result.planSettings, {});

          nextPlanData = {
            recordId: result.recordId,
            title: result.title,
            description: descriptionParsed || [],
            plan: Array.isArray(planParsed?.plan) ? planParsed.plan : [],
            requiredPermissions: requiredPermissionsParsed || {},
            planSettings: planSettingsParsed || {},
            credits: result.credits,
            userId: result.userId,
            status: result.status,
            updatedAt: result.updatedAt,
          };
        }

        if (!mounted) return;
        setPlanData(nextPlanData);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load blueprint');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [dispatch, isLibrarySource, planId, recordId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-600">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading blueprint...
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

  if (!planData) return null;

  return (
    <BlueprintBuilder
      planId={isLibrarySource ? null : recordId}
      planData={planData}
      mode={isLibrarySource ? 'clone' : 'edit'}
    />
  );
}
