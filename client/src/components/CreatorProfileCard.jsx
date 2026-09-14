import React, { useState } from 'react';
import { BadgeCheck, Calendar, GraduationCap, Building2 } from 'lucide-react';

/**
 * A bookplate pasted onto the page — ink stock with a brass rule, so it
 * reads as an inserted card rather than part of the surrounding sheet.
 */
export default function CreatorProfileCard({ profile }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!profile) return null;

  return (
    <div className="mt-4 rounded-sm bg-ink border border-brass/50 px-5 py-5 sm:px-6">
      {/* Identity */}
      <div className="flex items-center gap-4">
        <div className="rounded-full bg-brass p-[2px] shrink-0">
          {profile.imageUrl && !imageFailed ? (
            <img
              src={profile.imageUrl}
              alt={profile.name}
              onError={() => setImageFailed(true)}
              // Portrait source: bias the crop upward so the face, not the
              // background above the head, sits in the middle of the circle.
              style={{ objectPosition: 'center 18%' }}
              className="w-20 h-20 rounded-full object-cover bg-ink-soft"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-ink-soft flex items-center justify-center font-display text-lg font-semibold text-brass-light tracking-wide">
              {profile.initials || profile.name?.charAt(0)}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-display text-lg font-semibold text-parchment truncate">
              {profile.name}
            </h3>
            <BadgeCheck className="w-4 h-4 text-brass shrink-0" />
          </div>
          <p className="index-label text-brass mt-1">{profile.title}</p>
        </div>
      </div>

      {/* Catalogue entries */}
      <dl className="mt-5 pt-4 border-t border-brass/25 grid gap-3">
        <DetailRow icon={Calendar} label="Date of Birth" value={profile.dateOfBirth} />
        <DetailRow icon={GraduationCap} label="Education" value={profile.education} />
        <DetailRow icon={Building2} label="Institution" value={profile.institution} />
      </dl>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-sm border border-ink-line flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-brass" />
      </div>
      <div className="min-w-0">
        <dt className="index-label text-parchment-dim/70">{label}</dt>
        <dd className="text-sm text-parchment font-medium truncate">{value}</dd>
      </div>
    </div>
  );
}
