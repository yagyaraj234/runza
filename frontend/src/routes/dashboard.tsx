import { useEffect, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  Check,
  CircleCheck,
  Copy,
  ExternalLink,
  Github,
  GitPullRequest,
  Lock,
  LogOut,
} from 'lucide-react';
import RunzaLogo from '../components/RunzaLogo';
import { RepositorySettingsPanel } from '../components/RepositorySettingsPanel';
import {
  githubInstallUrl,
  listInstallations,
  listRepos,
  listRuns,
  logout,
  me,
  saveInstallation,
  type AuthUser,
  type Installation,
  type Repo,
  type Run,
} from '../lib/auth';

export const Route = createFileRoute('/dashboard')({
  validateSearch: (search: Record<string, unknown>): { installation_id?: string } =>
    typeof search.installation_id === 'string' || typeof search.installation_id === 'number'
      ? { installation_id: String(search.installation_id) }
      : {},
  component: DashboardPage,
});

const STATUS_COLORS: Record<string, string> = {
  passed: '#2F8F5B',
  failed: '#C23B4B',
  running: '#2B4BF2',
  queued: '#8A92C0',
};

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5">
      <p className="fb-mono m-0 text-[10px] tracking-[2px] text-[#8A92C0] uppercase">
        {label}
      </p>
      <p className="fb-serif m-0 mt-2 text-[1.75rem] leading-none text-[#131B4D]">
        {value}
      </p>
      {hint && <p className="m-0 mt-2 text-xs text-[#8A92C0]">{hint}</p>}
    </div>
  );
}

function InstallationBadge({ installationId }: { installationId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl bg-[#EEF2FE] px-4 py-3">
      <span className="text-xs font-medium text-[#3D4577]">Installation ID</span>
      <code className="fb-mono text-xs text-[#131B4D]">{installationId}</code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(installationId);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="text-[#8A92C0] transition hover:text-[#2B4BF2]"
        aria-label="Copy installation ID">
        {copied ? <Check size={14} color="#2F8F5B" /> : <Copy size={14} />}
      </button>
      <a
        href={`https://github.com/settings/installations/${installationId}`}
        target="_blank"
        rel="noreferrer"
        className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-[#2B4BF2] no-underline hover:underline">
        Manage on GitHub <ExternalLink size={12} />
      </a>
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const { installation_id } = Route.useSearch();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [installUrl, setInstallUrl] = useState('');
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(true);
  const [githubError, setGithubError] = useState('');
  const [runsError, setRunsError] = useState('');
  const [connecting, setConnecting] = useState(false);

  async function connectInstallation(id: number) {
    setConnecting(true);
    try {
      await saveInstallation(String(id));
      window.location.reload();
    } catch {
      setGithubError('Could not save the installation. Try again.');
      setConnecting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let current = await me();
      if (!current) {
        navigate({ to: '/login' });
        return;
      }
      if (installation_id) {
        await saveInstallation(installation_id).catch(() => {});
        current = (await me()) ?? current;
        navigate({ to: '/dashboard', replace: true });
      }
      if (cancelled) return;
      setUser(current);
      if (current.githubInstallationId) {
        const [repoList, runList] = await Promise.all([
          listRepos().catch(() => {
            setGithubError('Could not load repositories from GitHub.');
            return [];
          }),
          listRuns().catch(() => {
            setRunsError('Could not load recent runs.');
            return [];
          }),
        ]);
        if (cancelled) return;
        setRepos(repoList);
        setRuns(runList);
      } else {
        const [url, existing] = await Promise.all([
          githubInstallUrl().catch(() => {
            setGithubError('GitHub App is not configured on the server.');
            return '';
          }),
          listInstallations().catch(() => []),
        ]);
        if (cancelled) return;
        setInstallUrl(url);
        setInstallations(existing);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [installation_id, navigate]);

  const connected = Boolean(user?.githubInstallationId);

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F7FB]">
      {/* Dashboard shell — intentionally separate from the landing chrome */}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/80 [backdrop-filter:blur(20px)_saturate(180%)]">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-8">
          <Link to="/dashboard" className="no-underline" aria-label="Runza dashboard">
            <RunzaLogo className="h-7 w-auto" />
          </Link>
          <span className="fb-mono rounded-full bg-[#EEF2FE] px-3 py-1 text-[10px] tracking-[2px] text-[#3D4577] uppercase">
            Dashboard
          </span>
          <div className="ml-auto flex items-center gap-3">
            {user && (
              <span className="hidden text-sm text-[#545C8C] sm:inline">
                {user.email}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                logout();
                navigate({ to: '/login' });
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-medium text-[#131B4D] transition hover:bg-black/5">
              <LogOut size={13} /> Log out
            </button>
          </div>
        </div>
      </header>

      {loading || !user ? (
        <main className="flex flex-1 items-center justify-center">
          <p className="fb-mono text-[11px] tracking-[2px] text-[#8A92C0] uppercase">
            Loading…
          </p>
        </main>
      ) : (
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-8">
          <h1 className="fb-serif m-0 text-[2rem] leading-[1.15] text-[#131B4D]">
            Welcome, {user.name.split(' ')[0]}.
          </h1>
          <p className="mt-2 text-sm text-[#545C8C]">
            {connected
              ? 'Every pull request in your connected repositories gets tested automatically.'
              : 'Connect GitHub to start testing your pull requests.'}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StatTile
              label="GitHub"
              value={connected ? 'Connected' : 'Not connected'}
              hint={connected ? `Installation ${user.githubInstallationId}` : 'Install the app to begin'}
            />
            <StatTile
              label="Repositories"
              value={connected ? String(repos.length) : '—'}
              hint="Covered by the GitHub App"
            />
            <StatTile
              label="Runs"
              value={String(runs.length)}
              hint="Triggered from pull requests"
            />
          </div>

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-5">
            {/* GitHub connection */}
            <section className="rounded-2xl border border-black/5 bg-white p-7 lg:col-span-2">
              <div className="flex items-center gap-3">
                <Github size={18} className="text-[#131B4D]" />
                <h2 className="fb-serif m-0 text-lg text-[#131B4D]">GitHub</h2>
                {connected && (
                  <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#EAF6EF] px-3 py-1 text-xs font-semibold text-[#2F8F5B]">
                    <CircleCheck size={13} /> Connected
                  </span>
                )}
              </div>

              {connected ? (
                <>
                  {githubError && (
                    <p className="mt-3 text-[13px] text-[#C23B4B]" role="alert">
                      {githubError}
                    </p>
                  )}
                  <ul className="mt-4 list-none space-y-2 p-0">
                    {repos.map(repo => (
                      <li key={repo.fullName} className="grid gap-3 rounded-xl bg-[#F6F7FB] px-4 py-3 text-sm text-[#131B4D]">
                        <div className="flex items-center gap-2"><span className="truncate font-medium">{repo.fullName}</span>{repo.private&&<Lock size={13} className="shrink-0 text-[#8A92C0]"/>}<a href={repo.htmlUrl} target="_blank" rel="noreferrer" className="ml-auto shrink-0 text-[#8A92C0] transition hover:text-[#2B4BF2]" aria-label={`Open ${repo.fullName} on GitHub`}><ExternalLink size={14}/></a></div>
                        <RepositorySettingsPanel repo={repo}/>
                      </li>
                    ))}
                    {repos.length === 0 && !githubError && (
                      <li className="rounded-xl bg-[#F6F7FB] px-4 py-3 text-sm text-[#545C8C]">
                        No repositories in this installation yet.
                      </li>
                    )}
                  </ul>
                  {user.githubInstallationId && (
                    <InstallationBadge installationId={user.githubInstallationId} />
                  )}
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-[#545C8C]">
                    Install the GitHub App on your repositories. Once connected,
                    every PR triggers a test run with video evidence.
                  </p>
                  {githubError ? (
                    <p className="mt-4 text-[13px] text-[#C23B4B]" role="alert">
                      {githubError}
                    </p>
                  ) : (
                    <a
                      href={installUrl}
                      className="fb-cta-glow fb-press mt-5 inline-flex items-center gap-2 rounded-full bg-[#2B4BF2] px-6 py-3 text-sm font-semibold text-white no-underline transition hover:brightness-95">
                      <Github size={15} /> Connect GitHub
                    </a>
                  )}

                  {installations.length > 0 && (
                    <div className="mt-6 border-t border-black/5 pt-5">
                      <p className="fb-mono m-0 text-[10px] tracking-[2px] text-[#8A92C0] uppercase">
                        Already installed
                      </p>
                      <p className="mt-2 text-[13px] text-[#545C8C]">
                        Found existing installations of the app. Link one to
                        your account:
                      </p>
                      <ul className="mt-3 list-none space-y-2 p-0">
                        {installations.map(installation => (
                          <li key={installation.id}>
                            <button
                              type="button"
                              disabled={connecting}
                              onClick={() => connectInstallation(installation.id)}
                              className="flex w-full items-center gap-2 rounded-xl bg-[#F6F7FB] px-4 py-3 text-left text-sm text-[#131B4D] transition hover:bg-[#EEF2FE] disabled:opacity-60">
                              <Github size={14} className="shrink-0 text-[#8A92C0]" />
                              <span className="font-medium">{installation.account}</span>
                              <span className="fb-mono ml-auto text-[11px] text-[#8A92C0]">
                                #{installation.id}
                              </span>
                              <span className="text-xs font-semibold text-[#2B4BF2]">
                                {connecting ? 'Linking…' : 'Use'}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Runs */}
            <section className="rounded-2xl border border-black/5 bg-white p-7 lg:col-span-3">
              <div className="flex items-center gap-3">
                <GitPullRequest size={18} className="text-[#131B4D]" />
                <h2 className="fb-serif m-0 text-lg text-[#131B4D]">Recent runs</h2>
              </div>
              {runsError && (
                <p className="mt-3 text-[13px] text-[#C23B4B]" role="alert">
                  {runsError}
                </p>
              )}
              {runs.length === 0 && !runsError ? (
                <p className="mt-3 text-sm leading-relaxed text-[#545C8C]">
                  No runs yet.{' '}
                  {connected
                    ? 'Open a pull request in a connected repository to start one.'
                    : 'Connect GitHub to start testing your pull requests.'}
                </p>
              ) : runs.length > 0 ? (
                <ul className="mt-4 list-none space-y-2 p-0">
                  {runs.map(run => (
                    <li key={run.id}>
                    <Link to="/dashboard/runs/$runId" params={{runId:run.id}} className="flex items-center gap-3 rounded-xl bg-[#F6F7FB] px-4 py-3 text-sm no-underline transition hover:bg-[#EEF2FE] focus-visible:outline-2 focus-visible:outline-[#2B4BF2]">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{
                          background: STATUS_COLORS[run.status] ?? '#8A92C0',
                        }}
                      />
                      <span className="truncate font-medium text-[#131B4D]">
                        {run.repository ?? run.targetUrl}
                        {run.pullRequest ? ` #${run.pullRequest}` : ''}
                      </span>
                      <span className="fb-mono ml-auto shrink-0 text-[11px] text-[#8A92C0] uppercase">
                        {run.status}
                      </span>
                      <span className="hidden shrink-0 text-xs text-[#8A92C0] sm:inline">
                        {new Date(run.createdAt).toLocaleString()}
                      </span>
                    </Link></li>
                  ))}
                </ul>
              ) : null}
            </section>
          </div>
        </main>
      )}
    </div>
  );
}
