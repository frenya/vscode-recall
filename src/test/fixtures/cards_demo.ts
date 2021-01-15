export default [
  {
    "pages": [
      "# Memory card with text paragraphs",
      "This is the first paragraph. It will become the second page of the card\n(first one is the header itself).",
      "This is the second paragraph. It is separated from the first one by an empty line.\nIt will become the third page of the card.",
      "It is possible to *emphasize* text using standard Markdown notation."
    ],
    "offset": 24,
    "cardType": "#",
    "headerPath": [],
    "checksums": [ "878fb69ec2e9f2cdd6eb3636cf3a3147", "c1262e3fef29b0441d24b4fb61f70ea6" ]
  },
  {
    "pages": [
      "# Memory card with some text and bullets",
      "This is an explanatory text. It will become page 2 of the card.",
      "- Bullets are ignored in this case\n- regardless of their type",
      "* Line dividers are also ignored\n* Term: This is the definition"
    ],
    "offset": 364,
    "cardType": "#",
    "headerPath": [],
    "checksums": [ "b84d19d9920efbe7ff20d09de4483802", "9dc2e8bcc0de15a28081cf70a887c14d" ]
  },
  {
    "pages": [
      "# Explanation",
      "There needs to be at lease some content after a header in order for it\nto be considered a flashcard. Flashcard simply needs to have at least\ntwo pages, otherwise what's the point? ;)"
    ],
    "offset": 658,
    "cardType": "##",
    "headerPath": [
      "This header won't show as a card, see explanation below"
    ],
    "checksums": [ "1d828def5d295f5c190a65beccfb089e", "a84cd747fc0044a64279c65952690610" ]
  },
  {
    "pages": [
      "# Third level header",
      "Any header can start a new card. This one demonstrates how\nthe first and second level headers are both shown on the flashcard."
    ],
    "offset": 858,
    "cardType": "###",
    "headerPath": [
      "This header won't show as a card, see explanation below",
      "Explanation"
    ],
    "checksums": [ "844ec42cde773e4fab7aa1b4f024270c", "5fcf900fc54213d5f1a69fe001cc90dd" ]
  },
  {
    "pages": [
      "# Using spaces",
      "Markdown makes use  \nof trailing spaces.\n \nPutting two spaces at the end of a line  \nserves as a line break within a paragraph.\n \nYou can also use it to prevent an empty line from being a card page break.\nJust put a single space on it and it will be ignored.\n \nMake sure to set the `files.trimTrailingWhitespace` setting to `false`."
    ],
    "offset": 1010,
    "cardType": "###",
    "headerPath": [
      "This header won't show as a card, see explanation below",
      "Explanation"
    ],
    "checksums": [ "efc539ba285d33d504952aff496b6d86", "695eef3ce92a961c59878720fa7bfe2b" ]
  },
  {
    "pages": [
      "# Preterite: estar",
      "|Singular|Plural|\n|-|-|\n|est*uve* |est*uvi*mos|+\n|est*uvi*ste |est*uvi*steis|\n|est*uvo* |est*uvie*ron|"
    ],
    "offset": 1395,
    "cardType": "##",
    "headerPath": [
      "Rich content - tables, images"
    ],
    "checksums": [ "73970aebe8ade0af9a55c153f69ab89c", "53fd65d393642e34ea775f19c4cdd4b1" ]
  },
  {
    "pages": [
      "# Whose flag is this?\n![Flag](media/cz_flag.png)",
      "Answer: Czech Republic",
      "Note: Since there is no empty line between the header and the image, the image will appear on the first page of the card."
    ],
    "offset": 1520,
    "cardType": "##",
    "headerPath": [
      "Rich content - tables, images"
    ],
    "checksums": [ "e1e977db524c1bb0302082dd4c182a9a", "d35f3d4886813807982a5b64af45ff01" ]
  },
  {
    "pages": [
      "# Network images",
      "![Lenna](http://www.lenna.org/len_top.jpg)",
      "Lena Soderberg"
    ],
    "offset": 1718,
    "cardType": "##",
    "headerPath": [
      "Rich content - tables, images"
    ],
    "checksums": [ "6be1ab099167f402846d17619e6ccf9c", "fc5b33cb3d4c301a96c3685fda0b783c" ]
  },
  {
    "pages": [
      "# Hello World JS",
      "```javascript\nconst http = require('http');\n\nconst hostname = '127.0.0.1';\nconst port = 3000;\n\nconst server = http.createServer((req, res) => {\n  res.statusCode = 200;\n  res.setHeader('Content-Type', 'text/plain');\n  res.end('Hello World');\n});\n\nserver.listen(port, hostname, () => {\n  console.log(`Server running at http://${hostname}:${port}/`);\n});\n```"
    ],
    "offset": 1805,
    "cardType": "##",
    "headerPath": [
      "Code"
    ],
    "checksums": [ "7e49c23ec51cd9073bbff15f0a1373d9", "f030f8db8d16c99ae21d2fbb7331d894" ]
  }
];

