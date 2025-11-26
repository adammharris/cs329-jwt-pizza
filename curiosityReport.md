---
title: "Curiosity Report: Documentation"
author: Adam Harris
created: 2025-11-25
---

# Curiosity Report: Documentation

Documentation is an important part of every software project. As much as a developer may dream to have self-explanatory code, documentation nevertheless remains an integral resource—nearly as important as the code itself. Documentation introduces newcomers, and bridges the gaps between developers, designers, marketers, and other relevant roles. There are unlimited kinds of documentation: low-level, automated, high-level, static-site—as long as they serve the purpose of sharing knowledge about a codebase to another person, it can be considered a kind of documentation. In this report, I will answer common questions about documentation: where did it come from, why is it important, is there a best way to do it, and what is the industry-standard practice today?

## A brief history

Code documentation, in a relatively loose sense of the term, predates electronic computers by a century. Possibly the earliest example is Ada Lovelace's notes on Charles Babbage's "Analytical Engine" circa 1843—seven pages of detailed explanation including a description of how to use it to calculate Bernouli Numbers, which is also possibly the first published computer algorithm.[^1]

Regular pen and paper was the only way to encode information like this until about the 1940s, when electronic computers like the ENIAC opened avenues for new kinds of documentation that weren't only theoretical. Now documentation included punch cards and wiring diagrams, including not only purely mathematical instructions, but also practical instructions on how to operate a specific machine.[^2]

The first comments alongside code were probably in Fortran in the 1950s, where a letter 'C' at the beginning of a punchcard would signifiy that the contents of that punchcard were to be regarded as a comment rather than compiler instructions.[^3]

As hardware expanded and became more mainstream, documentation became a common need and took the form of manuals, binders, and by the 1970s, digital `man` pages.

## Different kinds of documentation

There are many different ways to document code, but each method essentially falls into one of two categories: low-level and high-level.[^4]

Low-level documentation today often takes the form of code comments, and is very technical in nature. It pays more attention to hardware, algorithmic details, and even compiler quirks. It helps software engineers understand the code at a very deep level.

High-level documentation is the opposite end of the spectrum. It takes the form of diagrams, quick-start guides, and "README" files. It is designed to show how the code works at a high level, either to help a designer or software engineer plan code architecture, or to help end-users learn how to use the software without needing to know all the details.

## Documentation today

In the past, the line between low-level and high-level documentation was blurred—both existed only on ink and paper. Nowadays, low-level documentation is often found in the code itself in the form of comments, and high-level documentation is often found in the form of Markdown files.

Low-level documentation, because it often lives right alongside the code itself, can easily be incorporated into a CI workflow. Tools like JavaDoc can compile code comments into a static website, making it possible to publish documentation at the same time as a new software release. High-level documentation finds similar flexibility in the form of Markdown.

Markdown is a markup language designed by John Gruber in 2004. It compiles to HTML and is designed to be "as readable as possible ...  without looking like it’s been marked up with tags or formatting instructions."[^5] These qualities have made it explode in popularity right along with the Web itself, and is now the ubiquitous markup language for code documentation. Countless tools exist to compile Markdown files to HTML, making it possible to publish high-level documentation as part of a software release.

## Additional tools

Unfortunately I cannot dive into all of these—each would be worth its own curiosity report. But here are some wonderful tools that integrate into Markdown:

1. Mermaid diagrams[^6]

Mermaid diagrams are a way to define diagrams using a text-based format and embed them in Markdown files. It is great for easy software diagrams alongside Markdown content!

2. YAML frontmatter

Many Markdown files have a YAML frontmatter section at the beginning of the file. These allow Markdown files to integrate structured metadata, making many new usecases possible: configuring static website generators, querying Markdown documents like a database, and more!

3. Github Flavored Markdown (GFM)

The most common Markdown extension spec, popularized by GitHub, gives Markdown many more features: tables, footnotes, math notes, and more!

4. Obsidian

The dominant Markdown editor today, Obsidian allows you to keep a "vault" of Markdown files, taking the use of Markdown beyond software documentation and making it useful for personal notes. Plugins make Markdown files capable of showing nearly any kind of information!

## Conclusion

Software documentation continues to improve alongside other technological advances. There are many new and exciting avenues in code documentation, with new advancements happening every day. Long gone are the days of binders and punch cards—now documentation is an essential part of every serious DevOps/QA workflow. Thanks to tools like static site generators and Markdown extensions like Mermaid diagrams and GFM, it is possible to write meaningful and engaging documentation right alongside software updates, integrated right into the development and CI process.

***

[^1]: <https://en.wikipedia.org/wiki/Ada_Lovelace#:~:text=These%20notes%20described%20a%20method,the%20first%20published%20computer%20program.>
[^2]: <https://en.wikipedia.org/wiki/ENIAC>
[^3]: <https://en.wikipedia.org/wiki/Fortran#Language_features:~:text=Reflecting%20punched%20card%20input%20practice%2C%20Fortran%20programs%20were%20originally%20written%20in%20a%20fixed%2Dcolumn%20format.%20A%20letter%20%22C%22%20in%20column%201%20caused%20the%20entire%20card%20to%20be%20treated%20as%20a%20comment%20and%20ignored%20by%20the%20compiler.>
[^4]: <https://www.ibm.com/think/topics/code-documentation>
[^5]: <https://www.markdownguide.org/getting-started/>
[^6]: https://mermaid.js.org/intro/
