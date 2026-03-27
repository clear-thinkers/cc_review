"use client";

import Link from "next/link";
import { useSession } from "@/lib/authContext";
import { canAccessRoute } from "@/lib/permissions";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";

type HomeFlowStep = {
  id: "addCharacters" | "allCharacters" | "addContent" | "dueReview" | "results";
  route: "/words/add" | "/words/all" | "/words/admin" | "/words/review" | "/words/results";
  role: "parent" | "child" | "shared";
  getPageTitle: (vm: WordsWorkspaceVM) => string;
};

const HOME_FLOW_STEPS: HomeFlowStep[] = [
  {
    id: "addCharacters",
    route: "/words/add",
    role: "parent",
    getPageTitle: (vm) => vm.str.add.pageTitle,
  },
  {
    id: "allCharacters",
    route: "/words/all",
    role: "shared",
    getPageTitle: (vm) => vm.str.all.pageTitle,
  },
  {
    id: "addContent",
    route: "/words/admin",
    role: "parent",
    getPageTitle: (vm) => vm.str.admin.pageTitle,
  },
  {
    id: "dueReview",
    route: "/words/review",
    role: "shared",
    getPageTitle: (vm) => vm.str.due.pageTitle,
  },
  {
    id: "results",
    route: "/words/results",
    role: "shared",
    getPageTitle: (vm) => vm.str.results.pageTitle,
  },
];

export default function HomeFlowSection({ vm }: { vm: WordsWorkspaceVM }) {
  const session = useSession();

  if (vm.page !== "home") {
    return null;
  }

  const role = session?.role;
  const isPlatformAdmin = session?.isPlatformAdmin ?? false;
  const home = vm.str.home;

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{home.pageTitle}</h2>
        <p className="max-w-3xl text-sm text-gray-700">{home.pageDescription}</p>
        <p className="text-sm text-gray-600">{home.helper}</p>
      </div>

      <div className="relative pl-5 sm:pl-8">
        <div
          aria-hidden="true"
          className="absolute bottom-4 left-[1.2rem] top-4 w-px bg-[#dcc38a]/55 sm:left-[1.95rem]"
        />
        <div className="space-y-4">
          {HOME_FLOW_STEPS.map((step, index) => {
            const stepText = home.steps[step.id];
            const stepNumber = index + 1;
            const canOpen = canAccessRoute(step.route, role, isPlatformAdmin);
            const pageTitle = step.getPageTitle(vm);
            const roleLabel =
              step.role === "parent"
                ? home.roleLabels.parent
                : step.role === "child"
                  ? home.roleLabels.child
                  : home.roleLabels.shared;
            const roleClass =
              step.role === "parent"
                ? "border-purple-300 bg-purple-50 text-purple-800"
                : step.role === "child"
                  ? "border-green-300 bg-green-50 text-green-800"
                  : "border-sky-300 bg-sky-50 text-sky-800";

            return (
              <article key={step.id} className="relative pl-9 sm:pl-12">
                <div
                  className="btn-neutral absolute left-0 top-6 flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold shadow-sm"
                >
                  {stepNumber}
                </div>
                <div className="space-y-3 rounded-[1.5rem] border-2 border-[#dcc38a] bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${roleClass}`}
                    >
                      {roleLabel}
                    </span>
                    <span className="text-xs uppercase tracking-[0.18em] text-[#bfa678]">
                      {home.pageTitleLabel}
                    </span>
                    <span className="text-xs font-semibold text-gray-700">{pageTitle}</span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-gray-900">{stepText.title}</h3>
                    <p className="text-sm leading-6 text-gray-600">{stepText.description}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {canOpen ? (
                      <Link
                        href={step.route}
                        className="btn-nav inline-flex min-h-10 items-center rounded-full border-2 px-5 py-2 text-sm font-semibold transition hover:bg-[#f8f1e3]"
                      >
                        {stepText.cta}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex min-h-10 items-center rounded-md border-2 px-4 py-2 text-sm font-semibold text-gray-500 btn-neutral"
                      >
                        {home.unavailableCta}
                      </button>
                    )}
                    {!canOpen ? (
                      <p className="text-sm text-gray-500">{home.unavailableHint}</p>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
