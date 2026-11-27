import type { ReactNode } from "react";

export default function DashboardTable({
  id,
  caption,
  headings,
  children,
}: {
  id: string;
  caption: string;
  headings: string[];
  children: ReactNode;
}) {
  return (
    <div className="dashboard-table" role="region" aria-labelledby={`${id}-caption`} tabIndex={0}>
      <table>
        <caption id={`${id}-caption`}>{caption}</caption>
        <thead>
          <tr>
            {headings.map((heading) => (
              <th key={heading} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
