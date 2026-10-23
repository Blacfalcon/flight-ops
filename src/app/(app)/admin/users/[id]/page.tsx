import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { publicUser } from '@/lib/selects';
import { personName } from '@/lib/constants';
import { formatDateTime } from '@/lib/time';
import { Card, PageHeader } from '@/components/ui';
import { UserAdminForm } from '@/components/user-admin-form';
import { PhotoUpload } from '@/components/photo-upload';

export const metadata = { title: 'Edit Person' };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('personnel.manage');
  const { id } = await params;
  const u = await db.user.findUnique({ where: { id }, select: publicUser });
  if (!u) notFound();
  const sessions = await db.session.count({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } } });
  return (
    <>
      <PageHeader
        back={{ href: '/admin/users', label: 'Personnel' }}
        title={personName(u)}
        sub={`Registered ${formatDateTime(u.createdAt)}${u.lastLoginAt ? ` · last sign-in ${formatDateTime(u.lastLoginAt)}` : ''} · ${sessions} active session${sessions === 1 ? '' : 's'}`}
      />
      <Card title="Photo">
        <PhotoUpload user={{ id: u.id, fullName: u.fullName, photoUpdatedAt: u.photoUpdatedAt?.toISOString() ?? null }} />
      </Card>
      <Card title="Particulars and Access">
        <UserAdminForm
          user={{
            id: u.id,
            rank: u.rank,
            firstName: u.firstName,
            middleName: u.middleName,
            surname: u.surname,
            nafNumber: u.nafNumber,
            email: u.email,
            phone: u.phone,
            appointment: u.appointment,
            flightStatus: u.flightStatus,
            pilotCategory: u.pilotCategory,
            accountStatus: u.accountStatus,
            totpEnabled: u.totpEnabled,
          }}
        />
      </Card>
    </>
  );
}
