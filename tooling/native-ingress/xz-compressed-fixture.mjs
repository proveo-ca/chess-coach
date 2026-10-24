// SPEC: _spec/tooling/native-ingress/xz-qualification.puml
// SPDX-License-Identifier: PSF-2.0
// Copyright (c) 2001-2024 Python Software Foundation; All Rights Reserved

const INPUT_HEX = 'fd377a585a000004e6d6b4460200210116000000742fe5a3e0078003df5d00051407625819cddd6e9815e4b49d6f1dc4e50a03cc3268c75c86fff8e2fce7d9fe36b828a87764c222752e6e1ec3f28e8d8f02172fa63df0a2df2f4d89bedea71c7a182d5dd5ef138f725a15808cf88d6ffa129b237a2feff0fa460182a34d8ea174ca3620424624e551a498eede6ce87ff09d2c626e0b13d4a881e44ec8861533f57832a24f134051a1002fa5d04f97dc6faef77ac4cd53b6743c16f29c4923897564c63659d9eee6ce125de5f0aa962d5065ad653a04091bf7db370a861f70c84abaf4f056a9dcf0022547f9df3d3f151be128ce823dd649ac33120c52b7ae0db169039501bdbefa027301509d9658b1326ac84ca88462f6c3d4632d48936f4a6cd06951e46b840bc1b7bcb11788b1ca3f40f607eae678f1483132500f8ac9ea7577e3beaa69a957d080cd2363623599d85da9640cbda2dc576ced5547bf897946f7378176bd3598be6838185708f01b99353a1a3f724496a1040faeba85eb9d3540f583d337838a6306d49769cd741653826bf64b01767988919b3654da650dfd5d3a6bba6ca9bb61c334f972eb7d72dbc7db2a8f037adc3868ccc9d3bc6ca52dcbea4ba2c515c0e3c1865afbeb4ce133cf9ce31dc9edc206ccce2192e5fe9c5ea53977209b50a3504b0864f9e25a7da7bfedeb25240c82b82fb001a9262cf771687b519629f27196c380b412b0bae66ff421b45bd48a7710f7740cb3d9d5c3605e81113f3f5ca4998552d48e83c91e58bf61f1acb0eaead7d0ab18e2f2ede1b7c918cb53e43ec99548e8cb090d25ebc7242e6ff1f352171d62bbd855a55ecc53160187f32f93d1f076c072d7cca2476b7aca800efdd08bbbd24978b31e79ca2d30e37a5ed6d68f5ff19d509f69a7d1e89084dcbfcd6b798edc817fa3b22bbf04efd85cc4dfe1b001e993e359f11d59e86881cff177ccb4ef208b7c04ea83656abe1fd47a9c60d31a924106e58fa913099e3dfa1ce55f9f25761b6f115a4fd8f409dd4d162d04fc183c22434ddd677e62f6ef8e0cd0de7ca0278a0cd678ae214aa646881575003817bc3779b3d875ac5f858de7c1409cec7163a323adf19335b5295f0dec335d0f6f5d35d06d79079bee81b50fcf4b2b00c0e46210e40c1a209be09774f6a19e8530ba0c9a8dc88f07d7aec8f92b69dcb96bb03e6619b80da8f81f24a57b70c68830cedbcfca5f86ac8868368b5a2527d00abf0f9c22bae5869f0f37583d6d4e585bcc194655c98630bc90612b2a20ae5f24031ed3cd5fa09cdeaf343671a5c992d7cae3609d857db4ffb383fbb6caae600b777ffcd8ac566519c8170b5aad88eb23970313b1640f7b0c0477070d97bdd6c1c3423a95085e1056ae614802d9e30a5c0158f69c8a06752325be2aa1187685ec21093400000000566a3f754c55f3a60001fb07810f000074779950b1c467fb020000000004595a';

const EXPECTED_PLAINTEXT = `
LAERTES

       O, fear me not.
       I stay too long: but here my father comes.

       Enter POLONIUS

       A double blessing is a double grace,
       Occasion smiles upon a second leave.

LORD POLONIUS

       Yet here, Laertes! aboard, aboard, for shame!
       The wind sits in the shoulder of your sail,
       And you are stay'd for. There; my blessing with thee!
       And these few precepts in thy memory
       See thou character. Give thy thoughts no tongue,
       Nor any unproportioned thought his act.
       Be thou familiar, but by no means vulgar.
       Those friends thou hast, and their adoption tried,
       Grapple them to thy soul with hoops of steel;
       But do not dull thy palm with entertainment
       Of each new-hatch'd, unfledged comrade. Beware
       Of entrance to a quarrel, but being in,
       Bear't that the opposed may beware of thee.
       Give every man thy ear, but few thy voice;
       Take each man's censure, but reserve thy judgment.
       Costly thy habit as thy purse can buy,
       But not express'd in fancy; rich, not gaudy;
       For the apparel oft proclaims the man,
       And they in France of the best rank and station
       Are of a most select and generous chief in that.
       Neither a borrower nor a lender be;
       For loan oft loses both itself and friend,
       And borrowing dulls the edge of husbandry.
       This above all: to thine ownself be true,
       And it must follow, as the night the day,
       Thou canst not then be false to any man.
       Farewell: my blessing season this in thee!

LAERTES

       Most humbly do I take my leave, my lord.

LORD POLONIUS

       The time invites you; go; your servants tend.

LAERTES

       Farewell, Ophelia; and remember well
       What I have said to you.

OPHELIA

       'Tis in my memory lock'd,
       And you yourself shall keep the key of it.

LAERTES

       Farewell.
`;

const EXPECTED_OUTPUT_HEX = Buffer.from(EXPECTED_PLAINTEXT, 'utf8').toString('hex');

export function createCompressedXzKnownAnswerFixture() {
  return Object.freeze({
    id: 'compressed-lzma2-crc64-known-answer',
    inputHex: INPUT_HEX,
    expectedExitCode: 0,
    expectedOutputHex: EXPECTED_OUTPUT_HEX,
    acceptOutput: true,
    memoryLimitBytes: 16777216,
    coverage: 'compressed-lzma2-known-answer',
    integrityCheck: true,
  });
}
