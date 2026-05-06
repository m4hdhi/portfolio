import { portfolioContent } from "./portfolio-content";

const config = {
  title: portfolioContent.profile.title,
  description: {
    long: portfolioContent.profile.descriptionLong,
    short: portfolioContent.profile.descriptionShort,
  },
  keywords: portfolioContent.profile.keywords,
  author: portfolioContent.profile.author,
  role: portfolioContent.profile.role,
  email: portfolioContent.profile.email,
  site: portfolioContent.profile.site,
  resumeUrl: portfolioContent.profile.resumeUrl,

  // for github stars button
  githubUsername: portfolioContent.profile.githubUsername,
  githubRepo: portfolioContent.profile.githubRepo,

  get ogImg() {
    return this.site + "/assets/seo/og-image.png";
  },
  social: {
    twitter: portfolioContent.social.twitter,
    linkedin: portfolioContent.social.linkedin,
    instagram: portfolioContent.social.instagram,
    facebook: portfolioContent.social.facebook,
    github: portfolioContent.social.github,
  },
};
export { config };
