import { useNavigate } from "react-router-dom";

const STEPS = [
  { label: "上传模板", path: "/app/batch/template" },
  { label: "配置替换组", path: "/app/batch/groups" },
  { label: "生成导出", path: "/app/batch/generate" },
];

type Props = {
  current: number; // 0-based index
};

export default function StepNav({ current }: Props) {
  const navigate = useNavigate();

  function handleBack() {
    if (current > 0) {
      navigate(STEPS[current - 1].path);
    }
  }

  return (
    <nav className="step-nav">
      {current > 0 ? (
        <button className="step-nav__back" onClick={handleBack} type="button">
          返回上一步
        </button>
      ) : (
        <div style={{ width: 72 }} />
      )}

      <div className="step-nav__steps">
        {STEPS.map((step, i) => {
          const isDone = i < current;
          const isActive = i === current;
          const dotClass = isDone
            ? "step-nav__dot step-nav__dot--done"
            : isActive
              ? "step-nav__dot step-nav__dot--active"
              : "step-nav__dot";
          const labelClass = isDone
            ? "step-nav__label step-nav__label--done"
            : isActive
              ? "step-nav__label step-nav__label--active"
              : "step-nav__label";

          return (
            <div key={step.path} className="step-nav__item">
              {i > 0 && (
                <div className={`step-nav__line${isDone ? " step-nav__line--done" : ""}`} />
              )}
              <div className={dotClass}>
                {isDone ? "✓" : i + 1}
              </div>
              <span className={labelClass}>{step.label}</span>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
