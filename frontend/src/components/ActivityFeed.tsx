import { Link } from "react-router-dom";
import type { AppActivity } from "../mock/appShell";

type ActivityFeedProps = {
  items: AppActivity[];
};

const KIND_LABEL: Record<AppActivity["kind"], string> = {
  chat: "聊天作图",
  batch: "批量作图",
  upload: "素材上传",
};

const STATUS_LABEL: Record<NonNullable<AppActivity["status"]>, string> = {
  success: "已完成",
  running: "进行中",
  failed: "失败",
};

export default function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <div className="activity-feed">
      {items.map((item) => (
        <article className="activity-feed__item" key={item.id}>
          <div className="activity-feed__main">
            <div className="activity-feed__meta">
              <span>{KIND_LABEL[item.kind]}</span>
              {item.status ? <span>{STATUS_LABEL[item.status]}</span> : null}
            </div>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </div>
          <div className="activity-feed__side">
            <time dateTime={item.at}>{new Date(item.at).toLocaleString("zh-CN")}</time>
            {item.href ? (
              <Link className="text-link" to={item.href}>
                查看
              </Link>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
