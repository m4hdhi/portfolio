import portfolioContent from "./portfolio-content.json";

export type PortfolioContent = typeof portfolioContent;
export type PortfolioSkill = PortfolioContent["skills"][number];
export type PortfolioExperience = PortfolioContent["experience"][number];
export type PortfolioProject = PortfolioContent["projects"][number];

export { portfolioContent };
